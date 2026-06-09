type NumberableOfferItem = {
  item_type?: string | null;
};

export function getOfferItemDisplayNumber(
  items: NumberableOfferItem[],
  index: number
): string | number {
  const item = items[index];
  if (!item || item.item_type === 'page_break') return '';

  const hasTitles = items.some((candidate) => candidate.item_type === 'title');

  if (!hasTitles) {
    let count = 0;
    for (let i = 0; i <= index; i++) {
      if (items[i]?.item_type !== 'page_break') count++;
    }
    return count;
  }

  let major = items[0]?.item_type === 'title' ? 0 : 1;
  let minor = 0;

  for (let i = 0; i <= index; i++) {
    const type = items[i]?.item_type;
    if (type === 'page_break') continue;

    if (type === 'title') {
      major += 1;
      minor = 0;
    } else {
      minor += 1;
    }
  }

  if (item.item_type === 'title') return `${major}`;
  return `${major}.${minor}`;
}
