from pathlib import Path
path = Path('apps/api/src/rooms/rooms.service.ts')
lines = path.read_text().splitlines()
for i in range(150, 180):
    print(f"{i+1}: {lines[i]}")
