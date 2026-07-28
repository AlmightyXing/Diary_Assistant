import os

files = ['frontend/src/App.tsx', 'frontend/src/DiaryPanel.tsx', 'frontend/src/Widget.tsx']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 替换 /data/
    content = content.replace('src="/data/', 'src="./data/')
    content = content.replace("src='/data/", "src='./data/")
    
    # 替换 http://localhost:8000
    if 'http://localhost:8000' in content:
        if 'API_BASE_URL' not in content:
            # 添加 import 语句
            lines = content.split('\n')
            last_import_idx = 0
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    last_import_idx = i
            
            lines.insert(last_import_idx + 1, "import { API_BASE_URL } from './config';")
            content = '\n'.join(lines)
                
        content = content.replace("'http://localhost:8000/", "API_BASE_URL + '/")
        content = content.replace("`http://localhost:8000/", "`${API_BASE_URL}/")
        
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print('Replacement complete.')
