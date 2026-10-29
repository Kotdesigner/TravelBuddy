//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

// Fehlermeldung als Windows-Dialog (die exe hat kein Konsolenfenster)
func meldungWindows(text string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	box := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(text)
	k, _ := syscall.UTF16PtrFromString("TravelBuddy")
	_, _, _ = box.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(k)), 0x10)
}
