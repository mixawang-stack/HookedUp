from pathlib import Path
text = Path(r"C:\Users\dada6\hookedup-mvp\apps\api\src\rooms\rooms.controller.ts").read_text()
idx = text.find('@Post(":id/share-links")')
print('idx', idx)
print(text[idx:idx+400])
