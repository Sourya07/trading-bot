export function getFlag(teamName: string): string {
  const normalized = teamName.toLowerCase().trim();
  
  // Special UK territories (special Unicode sequences)
  if (normalized.includes("england")) return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (normalized.includes("wales")) return "🏴󠁧󠁢󠁷󠁬󠁳󠁿";
  if (normalized.includes("scotland")) return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  
  // Comprehensive country to ISO-2 lookup
  const countryToIso: Record<string, string> = {
    andorra: "ad",
    angola: "ao",
    argentina: "ar",
    algeria: "dz",
    australia: "au",
    austria: "at",
    belgium: "be",
    brazil: "br",
    bulgaria: "bg",
    cameroon: "cm",
    canada: "ca",
    "cape verde": "cv",
    chile: "cl",
    china: "cn",
    colombia: "co",
    "costa rica": "cr",
    croatia: "hr",
    czechia: "cz",
    "czech republic": "cz",
    denmark: "dk",
    ecuador: "ec",
    egypt: "eg",
    finland: "fi",
    france: "fr",
    germany: "de",
    ghana: "gh",
    greece: "gr",
    hungary: "hu",
    iceland: "is",
    india: "in",
    indonesia: "id",
    iran: "ir",
    iraq: "iq",
    ireland: "ie",
    israel: "il",
    italy: "it",
    "ivory coast": "ci",
    jamaica: "jm",
    japan: "jp",
    jordan: "jo",
    kazakhstan: "kz",
    kenya: "ke",
    korea: "kr",
    "south korea": "kr",
    kuwait: "kw",
    latvia: "lv",
    lebanon: "lb",
    lithuania: "lt",
    luxembourg: "lu",
    malaysia: "my",
    mexico: "mx",
    morocco: "ma",
    netherlands: "nl",
    "new zealand": "nz",
    nigeria: "ng",
    norway: "no",
    oman: "om",
    pakistan: "pk",
    panama: "pa",
    paraguay: "py",
    peru: "pe",
    philippines: "ph",
    poland: "pl",
    portugal: "pt",
    qatar: "qa",
    romania: "ro",
    russia: "ru",
    "saudi arabia": "sa",
    senegal: "sn",
    serbia: "rs",
    slovakia: "sk",
    slovenia: "si",
    "south africa": "za",
    spain: "es",
    sweden: "se",
    switzerland: "ch",
    syria: "sy",
    thailand: "th",
    tunisia: "tn",
    turkey: "tr",
    ukraine: "ua",
    "united arab emirates": "ae",
    uae: "ae",
    uruguay: "uy",
    usa: "us",
    "united states": "us",
    venezuela: "ve",
    vietnam: "vn",
  };

  // Find matching ISO code
  const match = Object.keys(countryToIso).find(key => normalized.includes(key));
  if (match) {
    const isoCode = countryToIso[match];
    // Convert 2-letter ISO code to Flag Emoji
    return String.fromCodePoint(
      ...Array.from(isoCode.toUpperCase()).map(char => 127397 + char.charCodeAt(0))
    );
  }

  return "🏳️";
}
