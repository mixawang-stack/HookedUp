lines = open('apps/api/src/rooms/rooms.service.ts').read().splitlines()
for i in range(150, 175):
    print(i+1, lines[i])
