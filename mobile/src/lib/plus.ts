import type { Partner } from '../../../shared/contracts';

/** Public, current catalog values only; never infer an offer from a venue category. */
export function plusOffers(places: readonly { id: string; name: string }[], partner: (id: string) => Partner | undefined) {
  return places.flatMap((place) => {
    const info = partner(place.id);
    return info?.partner && info.discoverable
      ? [{ id: place.id, name: place.name, percent: info.plus_pct }]
      : [];
  });
}
