/**
 * Reference points so patients can search by town/neighbourhood without
 * granting precise location permission.
 */
export interface Area {
  key: string;
  label: string;
  town: string;
  lat: number;
  lng: number;
}

export const AREAS: Area[] = [
  { key: "nairobi-cbd", label: "Nairobi CBD", town: "Nairobi", lat: -1.2864, lng: 36.8172 },
  { key: "westlands", label: "Westlands", town: "Nairobi", lat: -1.2676, lng: 36.8108 },
  { key: "kilimani", label: "Kilimani", town: "Nairobi", lat: -1.2921, lng: 36.7872 },
  { key: "karen", label: "Karen", town: "Nairobi", lat: -1.3197, lng: 36.7076 },
  { key: "eastleigh", label: "Eastleigh", town: "Nairobi", lat: -1.2742, lng: 36.8461 },
  { key: "south-b", label: "South B", town: "Nairobi", lat: -1.3095, lng: 36.8335 },
  { key: "kasarani", label: "Kasarani", town: "Nairobi", lat: -1.2214, lng: 36.8985 },
  { key: "rongai", label: "Rongai", town: "Kajiado", lat: -1.3964, lng: 36.7586 },
  { key: "thika", label: "Thika Town", town: "Thika", lat: -1.0333, lng: 37.0693 },
  { key: "nyali", label: "Nyali, Mombasa", town: "Mombasa", lat: -4.0263, lng: 39.7164 },
  { key: "mombasa-cbd", label: "Mombasa CBD", town: "Mombasa", lat: -4.0435, lng: 39.6682 },
  { key: "kisumu", label: "Kisumu Town", town: "Kisumu", lat: -0.0917, lng: 34.768 },
  { key: "nakuru", label: "Nakuru Town", town: "Nakuru", lat: -0.3031, lng: 36.08 },
  { key: "eldoret", label: "Eldoret Town", town: "Eldoret", lat: 0.5143, lng: 35.2698 },
];

export const areaByKey = (key?: string | null): Area | undefined =>
  key ? AREAS.find((a) => a.key === key) : undefined;
