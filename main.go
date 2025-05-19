// filepath: go-wasm-project/main.go
package main

import (
	"encoding/base64"
	"fmt"
	"syscall/js"
	// "time" // For potential delays if needed for debugging, but not primary
)

func encodeBase64(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		// Return a map or object for structured error, parsable by JS
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	return js.ValueOf(base64.StdEncoding.EncodeToString([]byte(input)))
}

func decodeBase64(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	decoded, err := base64.StdEncoding.DecodeString(input)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": "Error decoding Base64: " + err.Error()})
	}
	return js.ValueOf(string(decoded))
}

// Add other Go functions that need to be exposed here...

func main() {
	c := make(chan struct{}, 0) // Prevents main from exiting

	fmt.Println("Go (WASM): main() started.")

	js.Global().Set("goEncodeBase64", js.FuncOf(encodeBase64))
	fmt.Println("Go (WASM): Exposed goEncodeBase64.")

	js.Global().Set("goDecodeBase64", js.FuncOf(decodeBase64))
	fmt.Println("Go (WASM): Exposed goDecodeBase64.")

	// Add other js.Global().Set calls here for other functions

	fmt.Println("Go (WASM): All functions exposed.")

	// Signal to JavaScript that Go WASM is ready
	goWasmReadyCb := js.Global().Get("goWasmReady")

	if !goWasmReadyCb.IsUndefined() && !goWasmReadyCb.IsNull() {
		fmt.Println("Go (WASM): Found goWasmReady() in JavaScript global scope. Attempting to call it.")
		// time.Sleep(1 * time.Second) // Optional: add a small delay if suspecting a race condition with JS setup, though unlikely here.
		goWasmReadyCb.Invoke()
		fmt.Println("Go (WASM): Successfully invoked goWasmReady() from Go.")
	} else {
		fmt.Println("Go (WASM): CRITICAL ERROR - goWasmReady JavaScript function NOT FOUND on js.Global().")
		fmt.Println("Go (WASM): Ensure 'self.goWasmReady = () => { ... };' is defined in the worker's global scope BEFORE wasm_exec.js and main.wasm are loaded/run.")
	}

	fmt.Println("Go (WASM): main() function has completed its setup and is now blocking to keep runtime alive.")
	<-c // Keep alive
}
