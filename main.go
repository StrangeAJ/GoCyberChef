// filepath: go-wasm-project/main.go
package main

import (
	"encoding/base64"
	"fmt"
	"syscall/js"
)

func main() {
	fmt.Println("Go WebAssembly Initialized!")

	// Expose a function to JavaScript
	js.Global().Set("goEncodeBase64", js.FuncOf(encodeBase64WASM))
	js.Global().Set("goDecodeBase64", js.FuncOf(decodeBase64WASM))

	// Keep the Go program running (otherwise it will exit immediately)
	// For more complex applications, you might manage this differently.
	select {}
}

// encodeBase64WASM is a wrapper for Base64 encoding to be called from JavaScript.
// It takes a single string argument and returns the Base64 encoded string.
// If the input is not a string or not provided, it returns an error string.
func encodeBase64WASM(this js.Value, args []js.Value) interface{} {
	if len(args) != 1 || args[0].Type() != js.TypeString {
		return "Error: Expected 1 string argument for ToBase64"
	}
	inputString := args[0].String()
	encoded := base64.StdEncoding.EncodeToString([]byte(inputString))
	// fmt.Printf("Go WASM: Encoding '%s' to '%s'\n", inputString, encoded) // Optional: for server-side Go debugging
	return encoded
}

// decodeBase64WASM is a wrapper for Base64 decoding to be called from JavaScript.
// It takes a single Base64 encoded string argument and returns the decoded string.
// If the input is not a string, not provided, or is invalid Base64, it returns an error string.
func decodeBase64WASM(this js.Value, args []js.Value) interface{} {
	if len(args) != 1 || args[0].Type() != js.TypeString {
		return "Error: Expected 1 string argument for FromBase64"
	}
	encodedString := args[0].String()
	decodedBytes, err := base64.StdEncoding.DecodeString(encodedString)
	if err != nil {
		// fmt.Printf("Go WASM: Error decoding Base64 string '%s': %s\n", encodedString, err.Error()) // Optional
		return "Error: Invalid Base64 input - " + err.Error()
	}
	decoded := string(decodedBytes)
	// fmt.Printf("Go WASM: Decoding '%s' to '%s'\n", encodedString, decoded) // Optional
	return decoded
}
