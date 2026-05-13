with open('style.css', 'r') as f:
    content = f.read()

content += """
.recipe-aes-options {
    display: grid;
    grid-template-columns: min-content min-content min-content;
    gap: 4px 8px;
    align-items: center;
}
.recipe-aes-options label {
    grid-column: 1;
    text-align: right;
}
.recipe-aes-options input[type="text"] {
    grid-column: 2;
}
.recipe-aes-options select {
    grid-column: 3;
}
"""

with open('style.css', 'w') as f:
    f.write(content)
