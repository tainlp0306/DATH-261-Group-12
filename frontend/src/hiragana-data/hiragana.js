export const hiraganaGroups = [
  {
    id: 'vowels',
    name: 'Hàng nguyên âm',
    description: 'Làm quen với 5 nguyên âm cơ bản',
    characters: ['あ', 'い', 'う', 'え', 'お'],
  },
  {
    id: 'k',
    name: 'Hàng K',
    description: 'Các âm bắt đầu bằng K',
    characters: ['か', 'き', 'く', 'け', 'こ'],
  },
  {
    id: 's',
    name: 'Hàng S',
    description: 'Các âm thuộc hàng S',
    characters: ['さ', 'し', 'す', 'せ', 'そ'],
  },
  {
    id: 't',
    name: 'Hàng T',
    description: 'Các âm thuộc hàng T',
    characters: ['た', 'ち', 'つ', 'て', 'と'],
  },
  {
    id: 'n',
    name: 'Hàng N',
    description: 'Các âm thuộc hàng N',
    characters: ['な', 'に', 'ぬ', 'ね', 'の'],
  },
  {
    id: 'h',
    name: 'Hàng H',
    description: 'Các âm thuộc hàng H',
    characters: ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  },
  {
    id: 'm',
    name: 'Hàng M',
    description: 'Các âm thuộc hàng M',
    characters: ['ま', 'み', 'む', 'め', 'も'],
  },
  {
    id: 'y',
    name: 'Hàng Y',
    description: 'Các âm thuộc hàng Y',
    characters: ['や', 'ゆ', 'よ'],
  },
  {
    id: 'r',
    name: 'Hàng R',
    description: 'Các âm thuộc hàng R',
    characters: ['ら', 'り', 'る', 'れ', 'ろ'],
  },
  {
    id: 'w',
    name: 'Hàng W',
    description: 'Các âm thuộc hàng W',
    characters: ['わ', 'を'],
  },
  {
    id: 'n-final',
    name: 'Âm ん',
    description: 'Âm mũi đặc biệt trong tiếng Nhật',
    characters: ['ん'],
  },
];

export const hiraganaCharacters = [
  { character: 'あ', romaji: 'a', groupId: 'vowels' },
  { character: 'い', romaji: 'i', groupId: 'vowels' },
  { character: 'う', romaji: 'u', groupId: 'vowels' },
  { character: 'え', romaji: 'e', groupId: 'vowels' },
  { character: 'お', romaji: 'o', groupId: 'vowels' },

  { character: 'か', romaji: 'ka', groupId: 'k' },
  { character: 'き', romaji: 'ki', groupId: 'k' },
  { character: 'く', romaji: 'ku', groupId: 'k' },
  { character: 'け', romaji: 'ke', groupId: 'k' },
  { character: 'こ', romaji: 'ko', groupId: 'k' },

  { character: 'さ', romaji: 'sa', groupId: 's' },
  { character: 'し', romaji: 'shi', groupId: 's' },
  { character: 'す', romaji: 'su', groupId: 's' },
  { character: 'せ', romaji: 'se', groupId: 's' },
  { character: 'そ', romaji: 'so', groupId: 's' },

  { character: 'た', romaji: 'ta', groupId: 't' },
  { character: 'ち', romaji: 'chi', groupId: 't' },
  { character: 'つ', romaji: 'tsu', groupId: 't' },
  { character: 'て', romaji: 'te', groupId: 't' },
  { character: 'と', romaji: 'to', groupId: 't' },

  { character: 'な', romaji: 'na', groupId: 'n' },
  { character: 'に', romaji: 'ni', groupId: 'n' },
  { character: 'ぬ', romaji: 'nu', groupId: 'n' },
  { character: 'ね', romaji: 'ne', groupId: 'n' },
  { character: 'の', romaji: 'no', groupId: 'n' },

  { character: 'は', romaji: 'ha', groupId: 'h' },
  { character: 'ひ', romaji: 'hi', groupId: 'h' },
  { character: 'ふ', romaji: 'fu', groupId: 'h' },
  { character: 'へ', romaji: 'he', groupId: 'h' },
  { character: 'ほ', romaji: 'ho', groupId: 'h' },

  { character: 'ま', romaji: 'ma', groupId: 'm' },
  { character: 'み', romaji: 'mi', groupId: 'm' },
  { character: 'む', romaji: 'mu', groupId: 'm' },
  { character: 'め', romaji: 'me', groupId: 'm' },
  { character: 'も', romaji: 'mo', groupId: 'm' },

  { character: 'や', romaji: 'ya', groupId: 'y' },
  { character: 'ゆ', romaji: 'yu', groupId: 'y' },
  { character: 'よ', romaji: 'yo', groupId: 'y' },

  { character: 'ら', romaji: 'ra', groupId: 'r' },
  { character: 'り', romaji: 'ri', groupId: 'r' },
  { character: 'る', romaji: 'ru', groupId: 'r' },
  { character: 'れ', romaji: 're', groupId: 'r' },
  { character: 'ろ', romaji: 'ro', groupId: 'r' },

  { character: 'わ', romaji: 'wa', groupId: 'w' },
  { character: 'を', romaji: 'wo', groupId: 'w' },
  { character: 'ん', romaji: 'n', groupId: 'n-final' },
];

export function getHiraganaByGroup(groupId) {
  if (groupId === 'all') {
    return hiraganaCharacters;
  }

  return hiraganaCharacters.filter(
    (item) => item.groupId === groupId
  );
}

export function getHiraganaCharacter(character) {
  return hiraganaCharacters.find(
    (item) => item.character === character
  );
}