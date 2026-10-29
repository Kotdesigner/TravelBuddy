//go:build !windows

package main

import "log"

func meldungWindows(text string) { log.Println(text) }
