// Maps country name to flag emoji (common F1 host countries)
const COUNTRY_FLAGS: Record<string, string> = {
  australia: '🇦🇺',
  austria: '🇦🇹',
  azerbaijan: '🇦🇿',
  bahrain: '🇧🇭',
  belgium: '🇧🇪',
  brazil: '🇧🇷',
  canada: '🇨🇦',
  china: '🇨🇳',
  france: '🇫🇷',
  germany: '🇩🇪',
  hungary: '🇭🇺',
  italy: '🇮🇹',
  japan: '🇯🇵',
  mexico: '🇲🇽',
  monaco: '🇲🇨',
  netherlands: '🇳🇱',
  saudi: '🇸🇦',
  singapore: '🇸🇬',
  spain: '🇪🇸',
  uae: '🇦🇪',
  uk: '🇬🇧',
  usa: '🇺🇸',
  ukraine: '🇺🇦',
  'united kingdom': '🇬🇧',
  'united states': '🇺🇸',
  'united arab emirates': '🇦🇪',
  'saudi arabia': '🇸🇦',
  österreich: '🇦🇹',
  belgien: '🇧🇪',
  deutschland: '🇩🇪',
  italia: '🇮🇹',
  espana: '🇪🇸',
  spa: '🇧🇪',
};

export function getCountryFlag(country: string): string {
  if (!country) return '🏁';
  const key = country.trim().toLowerCase();
  return COUNTRY_FLAGS[key] ?? '🏁';
}

export default function CountryFlag({ country, className }: { country: string; className?: string }) {
  return (
    <span className={className} role="img" aria-label={country}>
      {getCountryFlag(country)}
    </span>
  );
}
