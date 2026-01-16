from pathlib import Path
path = Path(r"C:\Users\dada6\hookedup-mvp\apps\api\src\rooms\rooms.controller.ts")
text = path.read_text()
marker = '\r\n  @Post(\":id/share-links\")'
print('marker found' if marker in text else 'marker missing')
print('start', text.index(marker))
end_marker = '\r\n  @Get(\":id/invite-candidates\")'
print('end', text.index(end_marker))
