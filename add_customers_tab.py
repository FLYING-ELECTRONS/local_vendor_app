# Add customers tab to index.html
with open(r'c:\SG_VEGETABLE AND FRUITS\index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Insert customers tab after line 1345 (Profit tab)
new_line = '                    <div class="cat-chip" id="tab-customers" onclick="switchAdminTab(\'customers\')">👥 Customers</div>\r\n'
lines.insert(1345, new_line)

with open(r'c:\SG_VEGETABLE AND FRUITS\index.html', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Customers tab added!")
