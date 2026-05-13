with open('style.css', 'r') as f:
    content = f.read()

content = content.replace('.recipe-aes-options input[type="text"] {\n    grid-column: 2;\n    width: 100%;\n}',
""".recipe-aes-options input[type="text"] {
    grid-column: 2;
    width: 100%;
    box-sizing: border-box;
    max-width: 120px;
}""")

with open('style.css', 'w') as f:
    f.write(content)
