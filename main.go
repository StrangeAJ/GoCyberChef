package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"syscall/js"
)

func encodeBase64(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
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

func encodeHex(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	return js.ValueOf(hex.EncodeToString([]byte(input)))
}

func decodeHex(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	decoded, err := hex.DecodeString(input)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": "Error decoding Hex: " + err.Error()})
	}
	return js.ValueOf(string(decoded))
}

func goMD5(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	hash := md5.Sum([]byte(input))
	return js.ValueOf(hex.EncodeToString(hash[:]))
}

func goSHA1(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	hash := sha1.Sum([]byte(input))
	return js.ValueOf(hex.EncodeToString(hash[:]))
}

func goSHA256(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	hash := sha256.Sum256([]byte(input))
	return js.ValueOf(hex.EncodeToString(hash[:]))
}

func goSHA512(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	hash := sha512.Sum512([]byte(input))
	return js.ValueOf(hex.EncodeToString(hash[:]))
}

func goURLEncode(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	return js.ValueOf(url.QueryEscape(input))
}

func goURLDecode(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	decoded, err := url.QueryUnescape(input)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": "Error decoding URL: " + err.Error()})
	}
	return js.ValueOf(decoded)
}

func goToUpperCase(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	return js.ValueOf(strings.ToUpper(input))
}

func goToLowerCase(this js.Value, args []js.Value) interface{} {
	if len(args) == 0 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string"})
	}
	input := args[0].String()
	return js.ValueOf(strings.ToLower(input))
}

func decodeData(data, format string) ([]byte, error) {
	switch format {
	case "Hex":
		return hex.DecodeString(data)
	case "Base64":
		return base64.StdEncoding.DecodeString(data)
	case "Raw":
		return []byte(data), nil
	default:
		return nil, fmt.Errorf("unknown format: %s", format)
	}
}

func encodeData(data []byte, format string) string {
	switch format {
	case "Hex":
		return hex.EncodeToString(data)
	case "Base64":
		return base64.StdEncoding.EncodeToString(data)
	default:
		return base64.StdEncoding.EncodeToString(data)
	}
}

func validateKeySize(key []byte) ([]byte, error) {
	kLen := len(key)
	if kLen == 16 || kLen == 24 || kLen == 32 {
		return key, nil
	}
	if kLen < 16 {
		padded := make([]byte, 16)
		copy(padded, key)
		return padded, nil
	} else if kLen < 24 {
		padded := make([]byte, 24)
		copy(padded, key)
		return padded, nil
	} else if kLen < 32 {
		padded := make([]byte, 32)
		copy(padded, key)
		return padded, nil
	}
	return key[:32], nil
}

func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	padText := make([]byte, padding)
	for i := range padText {
		padText[i] = byte(padding)
	}
	return append(data, padText...)
}

func pkcs7Unpad(data []byte) ([]byte, error) {
	length := len(data)
	if length == 0 {
		return nil, errors.New("data is empty")
	}
	unpadding := int(data[length-1])
	if unpadding > length {
		return nil, errors.New("invalid padding")
	}
	return data[:(length - unpadding)], nil
}

func parseOptions(opts js.Value) (key, iv []byte, mode, inputFormat, outputFormat string, err error) {
	if opts.Type() != js.TypeObject {
		err = errors.New("options must be an object")
		return
	}

	keyStr := opts.Get("key").String()
	keyFormat := opts.Get("keyFormat").String()
	if keyFormat == "" {
		keyFormat = "Raw"
	}

	key, err = decodeData(keyStr, keyFormat)
	if err != nil {
		err = fmt.Errorf("invalid key: %v", err)
		return
	}
	key, err = validateKeySize(key)
	if err != nil {
		return
	}

	ivStr := opts.Get("iv").String()
	ivFormat := opts.Get("ivFormat").String()
	if ivFormat == "" {
		ivFormat = "Raw"
	}

	iv, err = decodeData(ivStr, ivFormat)
	if err != nil {
		err = fmt.Errorf("invalid IV: %v", err)
		return
	}

	mode = opts.Get("mode").String()
	if mode == "" {
		mode = "GCM"
	}

	inputFormatObj := opts.Get("inputFormat")
	if !inputFormatObj.IsUndefined() {
		inputFormat = inputFormatObj.String()
	}

	outputFormatObj := opts.Get("outputFormat")
	if !outputFormatObj.IsUndefined() {
		outputFormat = outputFormatObj.String()
	}

	return
}

func aesEncrypt(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string and options must be provided"})
	}
	input := args[0].String()
	opts := args[1]

	key, iv, mode, _, outputFormat, err := parseOptions(opts)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": err.Error()})
	}
	if outputFormat == "" {
		outputFormat = "Base64"
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": err.Error()})
	}

	plaintext := []byte(input)
	var ciphertext []byte

	switch mode {
	case "GCM":
		aesgcm, err := cipher.NewGCM(block)
		if err != nil {
			return js.ValueOf(map[string]interface{}{"error": err.Error()})
		}
		nonce := iv
		if len(nonce) < aesgcm.NonceSize() {
			padded := make([]byte, aesgcm.NonceSize())
			copy(padded, nonce)
			nonce = padded
		} else if len(nonce) > aesgcm.NonceSize() {
			nonce = nonce[:aesgcm.NonceSize()]
		}
		ciphertext = aesgcm.Seal(nil, nonce, plaintext, nil)
	case "CBC":
		if len(iv) != aes.BlockSize {
			paddedIv := make([]byte, aes.BlockSize)
			copy(paddedIv, iv)
			iv = paddedIv
		}
		plaintext = pkcs7Pad(plaintext, aes.BlockSize)
		ciphertext = make([]byte, len(plaintext))
		cMode := cipher.NewCBCEncrypter(block, iv)
		cMode.CryptBlocks(ciphertext, plaintext)
	case "CFB":
		if len(iv) != aes.BlockSize {
			paddedIv := make([]byte, aes.BlockSize)
			copy(paddedIv, iv)
			iv = paddedIv
		}
		ciphertext = make([]byte, len(plaintext))
		stream := cipher.NewCFBEncrypter(block, iv)
		stream.XORKeyStream(ciphertext, plaintext)
	case "CTR":
		if len(iv) != aes.BlockSize {
			paddedIv := make([]byte, aes.BlockSize)
			copy(paddedIv, iv)
			iv = paddedIv
		}
		ciphertext = make([]byte, len(plaintext))
		stream := cipher.NewCTR(block, iv)
		stream.XORKeyStream(ciphertext, plaintext)
	default:
		return js.ValueOf(map[string]interface{}{"error": "Unsupported mode: " + mode})
	}

	return js.ValueOf(encodeData(ciphertext, outputFormat))
}

func aesDecrypt(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 || args[0].Type() != js.TypeString {
		return js.ValueOf(map[string]interface{}{"error": "Input must be a string and options must be provided"})
	}
	input := args[0].String()
	opts := args[1]

	key, iv, mode, inputFormat, _, err := parseOptions(opts)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": err.Error()})
	}
	if inputFormat == "" {
		inputFormat = "Base64"
	}

	ciphertext, err := decodeData(input, inputFormat)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": "Failed to decode input: " + err.Error()})
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return js.ValueOf(map[string]interface{}{"error": err.Error()})
	}

	var plaintext []byte

	switch mode {
	case "GCM":
		aesgcm, err := cipher.NewGCM(block)
		if err != nil {
			return js.ValueOf(map[string]interface{}{"error": err.Error()})
		}
		nonce := iv
		if len(nonce) < aesgcm.NonceSize() {
			padded := make([]byte, aesgcm.NonceSize())
			copy(padded, nonce)
			nonce = padded
		} else if len(nonce) > aesgcm.NonceSize() {
			nonce = nonce[:aesgcm.NonceSize()]
		}
		plaintext, err = aesgcm.Open(nil, nonce, ciphertext, nil)
		if err != nil {
			return js.ValueOf(map[string]interface{}{"error": "GCM Decrypt error: " + err.Error()})
		}
	case "CBC":
		if len(ciphertext) == 0 {
			return js.ValueOf(map[string]interface{}{"error": "Ciphertext is empty"})
		}
		if len(ciphertext)%aes.BlockSize != 0 {
			return js.ValueOf(map[string]interface{}{"error": "Ciphertext is not a multiple of the block size"})
		}
		if len(iv) != aes.BlockSize {
			paddedIv := make([]byte, aes.BlockSize)
			copy(paddedIv, iv)
			iv = paddedIv
		}
		plaintext = make([]byte, len(ciphertext))
		cMode := cipher.NewCBCDecrypter(block, iv)
		cMode.CryptBlocks(plaintext, ciphertext)
		plaintext, err = pkcs7Unpad(plaintext)
		if err != nil {
			return js.ValueOf(map[string]interface{}{"error": "Padding error: " + err.Error()})
		}
	case "CFB":
		if len(iv) != aes.BlockSize {
			paddedIv := make([]byte, aes.BlockSize)
			copy(paddedIv, iv)
			iv = paddedIv
		}
		plaintext = make([]byte, len(ciphertext))
		stream := cipher.NewCFBDecrypter(block, iv)
		stream.XORKeyStream(plaintext, ciphertext)
	case "CTR":
		if len(iv) != aes.BlockSize {
			paddedIv := make([]byte, aes.BlockSize)
			copy(paddedIv, iv)
			iv = paddedIv
		}
		plaintext = make([]byte, len(ciphertext))
		stream := cipher.NewCTR(block, iv)
		stream.XORKeyStream(plaintext, ciphertext)
	default:
		return js.ValueOf(map[string]interface{}{"error": "Unsupported mode: " + mode})
	}

	return js.ValueOf(string(plaintext))
}

func main() {
	c := make(chan struct{}, 0) // Prevents main from exiting

	fmt.Println("Go (WASM): main() started.")

	js.Global().Set("goEncodeBase64", js.FuncOf(encodeBase64))
	js.Global().Set("goDecodeBase64", js.FuncOf(decodeBase64))
	js.Global().Set("goEncodeHex", js.FuncOf(encodeHex))
	js.Global().Set("goDecodeHex", js.FuncOf(decodeHex))
	js.Global().Set("goMD5", js.FuncOf(goMD5))
	js.Global().Set("goSHA1", js.FuncOf(goSHA1))
	js.Global().Set("goSHA256", js.FuncOf(goSHA256))
	js.Global().Set("goSHA512", js.FuncOf(goSHA512))
	js.Global().Set("goURLEncode", js.FuncOf(goURLEncode))
	js.Global().Set("goURLDecode", js.FuncOf(goURLDecode))
	js.Global().Set("goToUpperCase", js.FuncOf(goToUpperCase))
	js.Global().Set("goToLowerCase", js.FuncOf(goToLowerCase))
	js.Global().Set("goAESEncrypt", js.FuncOf(aesEncrypt))
	js.Global().Set("goAESDecrypt", js.FuncOf(aesDecrypt))

	fmt.Println("Go (WASM): All functions exposed.")

	goWasmReadyCb := js.Global().Get("goWasmReady")

	if !goWasmReadyCb.IsUndefined() && !goWasmReadyCb.IsNull() {
		fmt.Println("Go (WASM): Found goWasmReady() in JavaScript global scope. Attempting to call it.")
		goWasmReadyCb.Invoke()
		fmt.Println("Go (WASM): Successfully invoked goWasmReady() from Go.")
	} else {
		fmt.Println("Go (WASM): CRITICAL ERROR - goWasmReady JavaScript function NOT FOUND on js.Global().")
	}

	fmt.Println("Go (WASM): main() function has completed its setup and is now blocking to keep runtime alive.")
	<-c // Keep alive
}
