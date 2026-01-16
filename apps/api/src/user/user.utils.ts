const adjectives = [
  "Silent",
  "Crimson",
  "Velvet",
  "Midnight",
  "Silver",
  "Neon",
  "Golden",
  "Shadow",
  "Wild",
  "Obsidian"
];

const animals = [
  "Fox",
  "Raven",
  "Wolf",
  "Tiger",
  "Swan",
  "Panther",
  "Falcon",
  "Lynx",
  "Owl",
  "Viper"
];

export function generateMaskName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${adjective}${animal}${suffix}`;
}
