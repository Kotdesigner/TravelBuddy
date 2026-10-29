// TravelBuddy für den Mac: eigenes Fenster statt Browser-Tab.
//
// Die App liefert die fertige Web-App (dist/, im Bundle unter Resources/web) über einen kleinen
// Server auf 127.0.0.1:8990 aus und zeigt sie in einem WKWebView. Kein Node, kein Python, kein Netz
// nötig. Der Server kann Range-Anfragen, die Offline-Karten (PMTiles) laden stückweise.
//
// Gleicher Port heißt gleicher Speicher: Daten liegen im WebKit-Speicher der App unter
// http://127.0.0.1:8990 und bleiben über Neustarts erhalten.
//
// Bauen: sh mac/baue-mac-app.sh
import Cocoa
import Network
import WebKit

let PORT: UInt16 = 8990

// MARK: - Mini-Server

final class Server {
  private let wurzel: URL
  private var listener: NWListener?
  private let queue = DispatchQueue(label: "travelbuddy.server", attributes: .concurrent)

  init(wurzel: URL) { self.wurzel = wurzel.standardizedFileURL }

  func start(fertig: @escaping (Error?) -> Void) {
    do {
      let p = NWParameters.tcp
      p.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: PORT)!)
      p.allowLocalEndpointReuse = true
      let l = try NWListener(using: p)
      l.newConnectionHandler = { [weak self] c in self?.bediene(c) }
      l.stateUpdateHandler = { zustand in
        switch zustand {
        case .ready: DispatchQueue.main.async { fertig(nil) }
        case .failed(let e): DispatchQueue.main.async { fertig(e) }
        default: break
        }
      }
      l.start(queue: queue)
      listener = l
    } catch { fertig(error) }
  }

  private func bediene(_ c: NWConnection) {
    c.start(queue: queue)
    lies(c, puffer: Data())
  }

  private func lies(_ c: NWConnection, puffer: Data) {
    c.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] daten, _, ende, fehler in
      guard let self else { return }
      var p = puffer
      if let daten { p.append(daten) }
      if let kopfEnde = p.range(of: Data("\r\n\r\n".utf8)) {
        let kopf = String(decoding: p[..<kopfEnde.lowerBound], as: UTF8.self)
        self.antworte(c, kopf: kopf)
      } else if fehler != nil || ende || p.count > 256 * 1024 {
        c.cancel()
      } else {
        self.lies(c, puffer: p)
      }
    }
  }

  private func antworte(_ c: NWConnection, kopf: String) {
    let zeilen = kopf.components(separatedBy: "\r\n")
    let teile = (zeilen.first ?? "").split(separator: " ")
    guard teile.count >= 2 else { return sende(c, status: "400 Bad Request", kopf: [:], koerper: Data()) }
    let methode = String(teile[0])
    var felder: [String: String] = [:]
    for z in zeilen.dropFirst() {
      if let i = z.firstIndex(of: ":") { felder[z[..<i].lowercased()] = z[z.index(after: i)...].trimmingCharacters(in: .whitespaces) }
    }
    guard methode == "GET" || methode == "HEAD" else { return sende(c, status: "405 Method Not Allowed", kopf: [:], koerper: Data()) }

    // Pfad: ohne Abfrage, entschlüsselt, nie aus dem Ordner heraus
    var pfad = String(teile[1].split(separator: "?", maxSplits: 1).first ?? "/")
    pfad = pfad.removingPercentEncoding ?? pfad
    if pfad.hasSuffix("/") { pfad += "index.html" }
    let datei = wurzel.appendingPathComponent(String(pfad.drop(while: { $0 == "/" }))).standardizedFileURL
    guard datei.path.hasPrefix(wurzel.path + "/"),
          let attr = try? FileManager.default.attributesOfItem(atPath: datei.path),
          (attr[.type] as? FileAttributeType) == .typeRegular,
          let groesse = (attr[.size] as? NSNumber)?.intValue
    else { return sende(c, status: "404 Not Found", kopf: ["Content-Type": "text/plain"], koerper: Data("Nicht gefunden".utf8)) }

    var kopfFelder = [
      "Content-Type": Server.typ(datei.pathExtension),
      "Accept-Ranges": "bytes",
      "Cache-Control": datei.lastPathComponent == "sw.js" || datei.pathExtension == "html" ? "no-cache" : "max-age=3600",
    ]
    var von = 0, bis = groesse - 1, status = "200 OK"
    if let r = felder["range"], r.hasPrefix("bytes=") {
      let b = r.dropFirst(6).split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
      if b.count == 2 {
        if b[0].isEmpty, let n = Int(b[1]) { von = max(0, groesse - n) }               // bytes=-500
        else if let a = Int(b[0]) { von = a; if let e = Int(b[1]) { bis = min(e, groesse - 1) } }
      }
      guard von <= bis, von < groesse else {
        return sende(c, status: "416 Range Not Satisfiable", kopf: ["Content-Range": "bytes */\(groesse)"], koerper: Data())
      }
      status = "206 Partial Content"
      kopfFelder["Content-Range"] = "bytes \(von)-\(bis)/\(groesse)"
    }
    let laenge = bis - von + 1
    kopfFelder["Content-Length"] = String(laenge)
    if methode == "HEAD" { return sende(c, status: status, kopf: kopfFelder, koerper: Data(), laengeGesetzt: true) }
    guard let h = try? FileHandle(forReadingFrom: datei) else { return sende(c, status: "500 Internal Server Error", kopf: [:], koerper: Data()) }
    defer { try? h.close() }
    try? h.seek(toOffset: UInt64(von))
    let koerper = (try? h.read(upToCount: laenge)) ?? Data()
    sende(c, status: status, kopf: kopfFelder, koerper: koerper, laengeGesetzt: true)
  }

  private func sende(_ c: NWConnection, status: String, kopf: [String: String], koerper: Data, laengeGesetzt: Bool = false) {
    var k = kopf
    if !laengeGesetzt { k["Content-Length"] = String(koerper.count) }
    k["Connection"] = "close"
    var text = "HTTP/1.1 \(status)\r\n"
    for (n, w) in k { text += "\(n): \(w)\r\n" }
    text += "\r\n"
    var antwort = Data(text.utf8)
    antwort.append(koerper)
    c.send(content: antwort, completion: .contentProcessed { _ in c.cancel() })
  }

  static func typ(_ endung: String) -> String {
    switch endung.lowercased() {
    case "html": return "text/html; charset=utf-8"
    case "js", "mjs": return "text/javascript; charset=utf-8"
    case "css": return "text/css; charset=utf-8"
    case "json": return "application/json; charset=utf-8"
    case "webmanifest": return "application/manifest+json"
    case "svg": return "image/svg+xml"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "webp": return "image/webp"
    case "woff2": return "font/woff2"
    case "pdf": return "application/pdf"
    case "pbf": return "application/x-protobuf"
    default: return "application/octet-stream"
    }
  }
}

// MARK: - Fenster mit der Web-App

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate {
  var fenster: NSWindow!
  var webView: WKWebView!
  var server: Server!
  var weitere: [NSWindow] = []   // Fenster für Belege (window.open)

  func applicationDidFinishLaunching(_ n: Notification) {
    baueMenue()
    guard let web = Bundle.main.resourceURL?.appendingPathComponent("web") else { return fehler("Die App-Dateien fehlen im Programm.") }
    server = Server(wurzel: web)
    server.start { [weak self] e in
      guard let self else { return }
      if let e { return self.fehler("TravelBuddy konnte nicht starten (Port \(PORT) belegt?).\n\n\(e.localizedDescription)") }
      self.zeigeFenster()
    }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }

  private func zeigeFenster() {
    let conf = WKWebViewConfiguration()
    conf.websiteDataStore = .default()
    conf.preferences.javaScriptCanOpenWindowsAutomatically = true
    // Sprache: WKWebView meldet die Sprache des Macs, weil das Bundle de.lproj und en.lproj hat (baue-mac-app.sh)
    webView = WKWebView(frame: .zero, configuration: conf)
    webView.uiDelegate = self
    webView.navigationDelegate = self
    webView.allowsBackForwardNavigationGestures = true
    if #available(macOS 13.3, *) { webView.isInspectable = true }

    fenster = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
                       styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
    fenster.title = "TravelBuddy"
    fenster.minSize = NSSize(width: 380, height: 560)
    fenster.contentView = webView
    fenster.setFrameAutosaveName("TravelBuddyHauptfenster")
    if !fenster.setFrameUsingName("TravelBuddyHauptfenster") { fenster.center() }
    fenster.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    webView.load(URLRequest(url: URL(string: "http://127.0.0.1:\(PORT)/")!))
  }

  private func fehler(_ text: String) {
    let a = NSAlert()
    a.messageText = "TravelBuddy"
    a.informativeText = text
    a.runModal()
    NSApp.terminate(nil)
  }

  // Links nach draußen (Google Maps, Wikipedia, Spotify) im Standardbrowser, die App selbst im Fenster
  func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if a.shouldPerformDownload { return decisionHandler(.download) }
    if let url = a.request.url, let host = url.host, host != "127.0.0.1", ["http", "https"].contains(url.scheme ?? ""),
       a.navigationType == .linkActivated || a.targetFrame == nil {
      NSWorkspace.shared.open(url)
      return decisionHandler(.cancel)
    }
    decisionHandler(.allow)
  }

  // Für den Test beim Bauen: TB_PRUEFEN=1 gibt nach dem Laden aus, was die Seite zeigt, und beendet die App
  func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
    guard w == webView, ProcessInfo.processInfo.environment["TB_PRUEFEN"] == "1" else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 8) {
      let js = """
      (async () => JSON.stringify({ titel: document.title, einfuehrung: document.querySelector('#ef-titel')?.textContent || null,
        fusszeile: document.querySelector('.app-footer')?.textContent || null, orte: document.querySelectorAll('a[href^="#/"]').length,
        speicher: await new Promise((ok) => { const r = indexedDB.open('tb-pruefen'); r.onsuccess = () => ok('ok'); r.onerror = () => ok('fehler') }),
        sw: !!navigator.serviceWorker, breite: innerWidth, sprache: localStorage.getItem('wa-sprache'), navigator: navigator.language,
        passkey: typeof PublicKeyCredential === 'undefined' ? 'fehlt' : String(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => 'fehler')) }))()
      """
      w.callAsyncJavaScript("return await " + js, arguments: [:], in: nil, in: .page) { r in
        switch r {
        case .success(let v): print("TB_PRUEFEN", v as? String ?? "\(v)")
        case .failure(let e): print("TB_PRUEFEN fehler", e.localizedDescription)
        }
        fflush(stdout)
        NSApp.terminate(nil)
      }
    }
  }

  func webView(_ w: WKWebView, decidePolicyFor r: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
    decisionHandler(r.canShowMIMEType ? .allow : .download)
  }

  func webView(_ w: WKWebView, navigationAction: WKNavigationAction, didBecome d: WKDownload) { d.delegate = self }
  func webView(_ w: WKWebView, navigationResponse: WKNavigationResponse, didBecome d: WKDownload) { d.delegate = self }

  // Backups und Exporte landen in „Downloads“
  func download(_ d: WKDownload, decideDestinationUsing r: URLResponse, suggestedFilename name: String, completionHandler: @escaping (URL?) -> Void) {
    let ordner = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
    var ziel = ordner.appendingPathComponent(name)
    let basis = ziel.deletingPathExtension().lastPathComponent, endung = ziel.pathExtension
    var i = 2
    while FileManager.default.fileExists(atPath: ziel.path) {
      ziel = ordner.appendingPathComponent("\(basis) \(i)").appendingPathExtension(endung); i += 1
    }
    completionHandler(ziel)
  }
  func downloadDidFinish(_ d: WKDownload) { NSSound(named: "Glass")?.play() }

  // window.open (Belege, Druckansichten): eigenes Fenster mit derselben Konfiguration
  func webView(_ w: WKWebView, createWebViewWith conf: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
    if let url = a.request.url, let host = url.host, host != "127.0.0.1" { NSWorkspace.shared.open(url); return nil }
    let neu = WKWebView(frame: .zero, configuration: conf)
    neu.uiDelegate = self
    neu.navigationDelegate = self
    let f = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 900, height: 900), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
    f.title = "TravelBuddy"
    f.contentView = neu
    f.isReleasedWhenClosed = false
    f.center()
    f.makeKeyAndOrderFront(nil)
    weitere.append(f)
    return neu
  }
  func webViewDidClose(_ w: WKWebView) { w.window?.close() }

  // Dateiauswahl (Belege, Fotos, Backup-Import)
  func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
    let panel = NSOpenPanel()
    panel.allowsMultipleSelection = p.allowsMultipleSelection
    panel.canChooseDirectories = p.allowsDirectories
    panel.canChooseFiles = true
    panel.begin { completionHandler($0 == .OK ? panel.urls : nil) }
  }

  func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
    let a = NSAlert(); a.messageText = m; a.runModal(); completionHandler()
  }
  func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
    let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Abbrechen")
    completionHandler(a.runModal() == .alertFirstButtonReturn)
  }

  // Ohne Menü gehen Kopieren, Einfügen und Beenden per Tastatur nicht
  private func baueMenue() {
    let haupt = NSMenu()
    func eintrag(_ titel: String, _ menue: NSMenu) { let i = NSMenuItem(); i.submenu = menue; menue.title = titel; haupt.addItem(i) }

    let app = NSMenu()
    app.addItem(withTitle: "Über TravelBuddy", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    app.addItem(.separator())
    app.addItem(withTitle: "TravelBuddy ausblenden", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    app.addItem(.separator())
    app.addItem(withTitle: "TravelBuddy beenden", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    eintrag("TravelBuddy", app)

    let bearbeiten = NSMenu()
    bearbeiten.addItem(withTitle: "Widerrufen", action: Selector(("undo:")), keyEquivalent: "z")
    bearbeiten.addItem(withTitle: "Wiederholen", action: Selector(("redo:")), keyEquivalent: "Z")
    bearbeiten.addItem(.separator())
    bearbeiten.addItem(withTitle: "Ausschneiden", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    bearbeiten.addItem(withTitle: "Kopieren", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    bearbeiten.addItem(withTitle: "Einsetzen", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    bearbeiten.addItem(withTitle: "Alles auswählen", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    eintrag("Bearbeiten", bearbeiten)

    let darstellung = NSMenu()
    darstellung.addItem(withTitle: "Neu laden", action: #selector(neuLaden), keyEquivalent: "r")
    darstellung.addItem(withTitle: "Vollbild", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f").keyEquivalentModifierMask = [.command, .control]
    eintrag("Darstellung", darstellung)

    let fensterMenue = NSMenu()
    fensterMenue.addItem(withTitle: "Im Dock ablegen", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    fensterMenue.addItem(withTitle: "Schließen", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    eintrag("Fenster", fensterMenue)
    NSApp.windowsMenu = fensterMenue
    NSApp.mainMenu = haupt
  }

  @objc func neuLaden() { webView?.reload() }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
