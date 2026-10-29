// TravelBuddy für Windows (29.10.2026): eine einzige TravelBuddy.exe.
//
// Die fertige Web-App (dist/) steckt in der exe. Beim Start liefert sie ein kleiner Server auf
// 127.0.0.1:8990 aus, und Microsoft Edge zeigt sie als eigenes Fenster ohne Adressleiste
// (--app, eigenes Profil unter %LOCALAPPDATA%\TravelBuddy). Edge gehört zu Windows 10 und 11.
// Fehlt Edge, öffnet Chrome oder der Standardbrowser. Kein Node, kein Python, kein Netz nötig.
//
// Gleicher Port heißt gleicher Speicher: Daten liegen im Edge-Profil der App und bleiben erhalten.
// Läuft TravelBuddy schon, öffnet ein zweiter Start nur ein neues Fenster.
//
// Bauen: sh win/baue-windows.sh   (auf dem Mac testen: go run ./win mit TB_OHNE_FENSTER=1)
package main

import (
	"embed"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed all:web
var dateien embed.FS

const adresse = "127.0.0.1:8990"
const url = "http://" + adresse + "/"

// Zuletzt bedient (Unix-Sekunden): wichtig, falls Edge das Fenster an einen schon laufenden Edge abgibt
var zuletzt atomic.Int64

func main() {
	web, err := fs.Sub(dateien, "web")
	if err != nil {
		melde("Die App-Dateien fehlen im Programm.")
	}
	ln, err := net.Listen("tcp", adresse)
	if err != nil {
		// Port belegt: läuft TravelBuddy schon? Dann nur ein Fenster öffnen.
		if laeuftSchon() {
			oeffneFenster()
			return
		}
		melde("TravelBuddy konnte nicht starten: Port 8990 ist von einem anderen Programm belegt.")
	}
	zuletzt.Store(time.Now().Unix())
	dateiServer := http.FileServer(http.FS(web))
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		zuletzt.Store(time.Now().Unix())
		pfad := r.URL.Path
		if pfad == "/sw.js" || pfad == "/" || strings.HasSuffix(pfad, ".html") {
			w.Header().Set("Cache-Control", "no-cache")
		}
		if strings.HasSuffix(pfad, ".webmanifest") {
			w.Header().Set("Content-Type", "application/manifest+json")
		}
		if strings.HasSuffix(pfad, ".pmtiles") || strings.HasSuffix(pfad, ".pbf") {
			w.Header().Set("Content-Type", "application/octet-stream")
		}
		dateiServer.ServeHTTP(w, r) // kann Range-Anfragen (Offline-Karten laden stückweise)
	})}
	go func() { _ = srv.Serve(ln) }()

	if os.Getenv("TB_OHNE_FENSTER") == "1" {
		select {} // nur Server, zum Testen
	}
	beginn := time.Now()
	fenster := oeffneFenster()
	if fenster != nil {
		_ = fenster.Wait()
		// Eigenes Edge-Profil: das Fenster lebt so lange wie der Prozess. Kam Wait sofort zurück,
		// hat Edge an einen laufenden Edge übergeben. Dann weiterlaufen, bis 30 Minuten lang
		// niemand mehr etwas geholt hat.
		if time.Since(beginn) > 8*time.Second {
			return
		}
	}
	for {
		time.Sleep(time.Minute)
		if time.Since(time.Unix(zuletzt.Load(), 0)) > 30*time.Minute {
			return
		}
	}
}

func laeuftSchon() bool {
	c := http.Client{Timeout: 2 * time.Second}
	r, err := c.Get(url + "index.html")
	if err != nil {
		return false
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(r.Body, 4096))
	return strings.Contains(string(b), "TravelBuddy")
}

// Öffnet das App-Fenster. Gibt den Prozess zurück, wenn er dem Fenster gehört (Edge/Chrome mit eigenem Profil).
func oeffneFenster() *exec.Cmd {
	switch runtime.GOOS {
	case "windows":
		profil := filepath.Join(os.Getenv("LOCALAPPDATA"), "TravelBuddy", "Fenster")
		_ = os.MkdirAll(profil, 0o755)
		argumente := []string{"--app=" + url, "--user-data-dir=" + profil, "--window-size=1280,860", "--no-first-run", "--no-default-browser-check"}
		for _, p := range browserPfade() {
			if _, err := os.Stat(p); err == nil {
				cmd := exec.Command(p, argumente...)
				if cmd.Start() == nil {
					return cmd
				}
			}
		}
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		_ = exec.Command("open", url).Start()
	default:
		_ = exec.Command("xdg-open", url).Start()
	}
	return nil
}

func browserPfade() []string {
	var p []string
	for _, wurzel := range []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles"), os.Getenv("LOCALAPPDATA")} {
		if wurzel == "" {
			continue
		}
		p = append(p,
			filepath.Join(wurzel, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(wurzel, "Google", "Chrome", "Application", "chrome.exe"))
	}
	return p
}

func melde(text string) {
	if runtime.GOOS == "windows" {
		meldungWindows(text)
	} else {
		log.Println(text)
	}
	os.Exit(1)
}
