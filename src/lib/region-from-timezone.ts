/**
 * The device's time zone says where the device actually is, whatever language the phone is set
 * to (a French-language phone in Casablanca reports "Africa/Casablanca", not France). No
 * permission prompt, no network call: Intl reports it locally.
 *
 * Intl has no zone -> country table, so this is a compact one for common zones. A zone that
 * isn't listed still yields its city ("America/Argentina/Salta" -> "Salta"), which is enough for
 * THEIA to pick local food.
 */
export const ZONE_COUNTRY: Record<string, string> = {
  // Africa
  'Africa/Casablanca': 'MA', 'Africa/El_Aaiun': 'MA', 'Africa/Algiers': 'DZ', 'Africa/Tunis': 'TN', 'Africa/Tripoli': 'LY',
  'Africa/Cairo': 'EG', 'Africa/Khartoum': 'SD', 'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Abidjan': 'CI',
  'Africa/Dakar': 'SN', 'Africa/Bamako': 'ML', 'Africa/Nouakchott': 'MR', 'Africa/Niamey': 'NE', 'Africa/Ndjamena': 'TD',
  'Africa/Douala': 'CM', 'Africa/Kinshasa': 'CD', 'Africa/Lubumbashi': 'CD', 'Africa/Luanda': 'AO', 'Africa/Nairobi': 'KE',
  'Africa/Addis_Ababa': 'ET', 'Africa/Mogadishu': 'SO', 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Kampala': 'UG', 'Africa/Kigali': 'RW',
  'Africa/Johannesburg': 'ZA', 'Africa/Maputo': 'MZ', 'Africa/Harare': 'ZW', 'Africa/Lusaka': 'ZM', 'Africa/Windhoek': 'NA',
  'Africa/Gaborone': 'BW', 'Africa/Conakry': 'GN', 'Africa/Ouagadougou': 'BF', 'Africa/Lome': 'TG', 'Africa/Porto-Novo': 'BJ',
  'Africa/Libreville': 'GA', 'Africa/Djibouti': 'DJ', 'Africa/Asmara': 'ER', 'Indian/Antananarivo': 'MG', 'Indian/Mauritius': 'MU',
  // Middle East / Asia
  'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH', 'Asia/Kuwait': 'KW', 'Asia/Muscat': 'OM',
  'Asia/Aden': 'YE', 'Asia/Baghdad': 'IQ', 'Asia/Amman': 'JO', 'Asia/Beirut': 'LB', 'Asia/Damascus': 'SY', 'Asia/Jerusalem': 'IL',
  'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS', 'Asia/Tehran': 'IR', 'Europe/Istanbul': 'TR', 'Asia/Istanbul': 'TR', 'Asia/Baku': 'AZ',
  'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM', 'Asia/Kabul': 'AF', 'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Dhaka': 'BD', 'Asia/Kathmandu': 'NP', 'Asia/Colombo': 'LK', 'Indian/Maldives': 'MV', 'Asia/Tashkent': 'UZ', 'Asia/Almaty': 'KZ',
  'Asia/Bishkek': 'KG', 'Asia/Dushanbe': 'TJ', 'Asia/Ashgabat': 'TM', 'Asia/Shanghai': 'CN', 'Asia/Urumqi': 'CN', 'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Pyongyang': 'KP', 'Asia/Ulaanbaatar': 'MN', 'Asia/Bangkok': 'TH',
  'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Asia/Phnom_Penh': 'KH', 'Asia/Vientiane': 'LA', 'Asia/Yangon': 'MM',
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Singapore': 'SG', 'Asia/Jakarta': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID',
  'Asia/Manila': 'PH', 'Asia/Brunei': 'BN',
  // Europe
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Brussels': 'BE', 'Europe/Amsterdam': 'NL',
  'Europe/Luxembourg': 'LU', 'Europe/Berlin': 'DE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES', 'Europe/Lisbon': 'PT', 'Europe/Rome': 'IT', 'Europe/Malta': 'MT', 'Europe/Athens': 'GR', 'Asia/Nicosia': 'CY',
  'Europe/Copenhagen': 'DK', 'Europe/Oslo': 'NO', 'Europe/Stockholm': 'SE', 'Europe/Helsinki': 'FI', 'Atlantic/Reykjavik': 'IS',
  'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Bratislava': 'SK', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO',
  'Europe/Sofia': 'BG', 'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI', 'Europe/Sarajevo': 'BA',
  'Europe/Skopje': 'MK', 'Europe/Tirane': 'AL', 'Europe/Podgorica': 'ME', 'Europe/Chisinau': 'MD', 'Europe/Kyiv': 'UA',
  'Europe/Kiev': 'UA', 'Europe/Minsk': 'BY', 'Europe/Vilnius': 'LT', 'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE', 'Europe/Moscow': 'RU',
  'Europe/Samara': 'RU', 'Asia/Yekaterinburg': 'RU', 'Asia/Novosibirsk': 'RU', 'Asia/Vladivostok': 'RU',
  // Americas
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Phoenix': 'US', 'America/Los_Angeles': 'US',
  'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Detroit': 'US', 'America/Toronto': 'CA', 'America/Montreal': 'CA',
  'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA', 'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX', 'America/Tijuana': 'MX', 'America/Cancun': 'MX', 'America/Guatemala': 'GT', 'America/El_Salvador': 'SV',
  'America/Tegucigalpa': 'HN', 'America/Managua': 'NI', 'America/Costa_Rica': 'CR', 'America/Panama': 'PA', 'America/Havana': 'CU',
  'America/Santo_Domingo': 'DO', 'America/Port-au-Prince': 'HT', 'America/Jamaica': 'JM', 'America/Puerto_Rico': 'PR',
  'America/Bogota': 'CO', 'America/Caracas': 'VE', 'America/Lima': 'PE', 'America/Guayaquil': 'EC', 'America/La_Paz': 'BO',
  'America/Santiago': 'CL', 'America/Argentina/Buenos_Aires': 'AR', 'America/Buenos_Aires': 'AR', 'America/Montevideo': 'UY',
  'America/Asuncion': 'PY', 'America/Sao_Paulo': 'BR', 'America/Manaus': 'BR', 'America/Fortaleza': 'BR', 'America/Recife': 'BR',
  'America/Bahia': 'BR',
  // Oceania
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU',
  'Australia/Hobart': 'AU', 'Australia/Darwin': 'AU', 'Pacific/Auckland': 'NZ', 'Pacific/Fiji': 'FJ', 'Pacific/Port_Moresby': 'PG',
};

const countryName = (code: string): string => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

/** Country (or city) from a time zone id; '' for UTC / generic zones. */
export const regionFromTimeZone = (zone: string | undefined): string => {
  if (!zone || !zone.includes('/') || /^(Etc|UTC|GMT|SystemV)\b/.test(zone)) return '';
  const code = ZONE_COUNTRY[zone];
  if (code) return countryName(code);
  const city = zone.split('/').pop() || '';
  return city.replace(/_/g, ' ').trim();
};

export const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};
