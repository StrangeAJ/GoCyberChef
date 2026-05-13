import re
with open('style.css', 'r') as f:
    content = f.read()

content = re.sub(r'\.recipe-aes-options \{\n    display: grid;\n    grid-template-columns: min-content min-content min-content;\n    gap: 4px 8px;\n    align-items: center;\n\}',
""".recipe-aes-options {
    display: grid;
    grid-template-columns: min-content 1fr min-content;
    gap: 4px 8px;
    align-items: center;
    margin-top: 10px;
    font-size: 0.85em;
    background: #333;
    padding: 8px;
    border-radius: 4px;
}""", content)

content = re.sub(r'\.recipe-aes-options input\[type="text"\] \{\n    grid-column: 2;\n\}',
""".recipe-aes-options input[type="text"] {
    grid-column: 2;
    width: 100%;
}""", content)


with open('style.css', 'w') as f:
    f.write(content)
