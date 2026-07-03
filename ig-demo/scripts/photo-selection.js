export const CARD_PHOTO_COUNT = 4;

function uniquePhotos(listing) {
  const images = Array.isArray(listing.images) ? listing.images : [];
  const sources = [...images, listing.image].filter(Boolean);
  const seen = new Set();

  return sources.filter((source) => {
    const key = String(source).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function selectListingPhotos(listing) {
  const photos = uniquePhotos(listing);
  return {
    cardPhotos: photos.slice(0, CARD_PHOTO_COUNT),
    carouselPhotos: photos.slice(CARD_PHOTO_COUNT),
  };
}
