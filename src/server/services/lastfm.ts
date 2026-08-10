/**
 * Last.fm API Type-Safe Service
 * ActionVerse Music & Last.fm Integration
 */

const FALLBACK_ALBUM_ART = "/images/logo.png";
const LASTFM_STAR_ICON_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

export interface LastFmTrack {
  name: string;
  artist: {
    "#text": string;
    mbid?: string;
  };
  album: {
    "#text": string;
    mbid?: string;
  };
  url: string;
  date?: {
    uts: string;
    "#text": string;
  };
  image?: {
    "#text": string;
    size: "small" | "medium" | "large" | "extralarge";
  }[];
  duration?: string;
}

export interface LastFmRecentTracksResponse {
  recenttracks?: {
    track: LastFmTrack[];
    "@attr"?: {
      user: string;
      totalPages: string;
      page: string;
      perPage: string;
      total: string;
    };
  };
  error?: number;
  message?: string;
}

export interface LastFmAuthSessionResponse {
  session?: {
    name: string;
    key: string;
    subscriber: number;
  };
  error?: number;
  message?: string;
}

export interface SearchTrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  durationSec: number;
  lastFmUrl: string;
}

function extractUrlFromStringOrObj(item: any): string | null {
  if (!item) return null;
  if (typeof item === "string" && item.trim().startsWith("http")) return item.trim();
  if (typeof item === "object") {
    const text = item["#text"] || item["url"] || item["src"] || item["href"];
    if (typeof text === "string" && text.trim().startsWith("http")) return text.trim();
  }
  return null;
}

function getTrackImageUrl(t: any, fallbackUrl: string): string {
  if (!t) return fallbackUrl;
  const images = Array.isArray(t.image)
    ? t.image
    : t.album?.image
      ? Array.isArray(t.album.image)
        ? t.album.image
        : [t.album.image]
      : t.image
        ? [t.image]
        : Array.isArray(t)
          ? t
          : [];

  for (const size of ["extralarge", "mega", "large", "medium", "small"]) {
    const foundObj = images.find((i: any) => typeof i === "object" && i?.size === size);
    const url = extractUrlFromStringOrObj(foundObj);
    if (url && !url.includes(LASTFM_STAR_ICON_HASH)) return url;
  }

  for (const img of images) {
    const url = extractUrlFromStringOrObj(img);
    if (url && !url.includes(LASTFM_STAR_ICON_HASH)) return url;
  }

  return fallbackUrl;
}

/**
 * Resolves track artwork using Last.fm API with 3 tiers fired in parallel:
 * - Tier 1: track.getinfo → album.image
 * - Tier 2: artist.getinfo → image
 * - Tier 3: /images/logo.png (website logo)
 * All tiers race concurrently; first valid URL wins.
 */
export async function fetchTrackArtwork(
  artist: string,
  title: string,
  currentImgUrl?: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey ?? process.env.NEXT_PUBLIC_LASTFM_API_KEY

  // If we already have a valid non-placeholder URL, use it
  if (
    currentImgUrl &&
    !currentImgUrl.includes(LASTFM_STAR_ICON_HASH) &&
    currentImgUrl !== FALLBACK_ALBUM_ART &&
    currentImgUrl.trim().length > 10
  ) {
    return currentImgUrl.trim();
  }

  const cleanArtist = artist?.trim() || "";
  const cleanTitle = title?.trim() || "";

  // Helper: fetch track.getinfo image
  async function getTrackImg(): Promise<string> {
    if (!cleanArtist || !cleanTitle) return "";
    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=track.getinfo&artist=${encodeURIComponent(cleanArtist)}&track=${encodeURIComponent(cleanTitle)}&api_key=${key}&format=json`;
      const res = await fetch(url, { headers: { "User-Agent": "ActionVerse/1.0" } });
      if (!res.ok) return "";
      const data = await res.json();
      // Try album image from track.getinfo
      const trackAlbumImg = getTrackImageUrl(data?.track?.album?.image, "");
      if (trackAlbumImg) return trackAlbumImg;
      // Try album.getinfo for richer image
      const albumMbid = data?.track?.album?.mbid as string | undefined;
      const albumTitle = data?.track?.album?.title as string | undefined;
      if (albumMbid || albumTitle) {
        const albumUrl = albumMbid
          ? `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&mbid=${albumMbid}&api_key=${key}&format=json`
          : `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist=${encodeURIComponent(cleanArtist)}&album=${encodeURIComponent(albumTitle!)}&api_key=${key}&format=json`;
        const res2 = await fetch(albumUrl, { headers: { "User-Agent": "ActionVerse/1.0" } });
        if (res2.ok) {
          const data2 = await res2.json();
          return getTrackImageUrl(data2?.album?.image, "");
        }
      }
    } catch { /* fall through */ }
    return "";
  }

  // Helper: fetch artist.getinfo image
  async function getArtistImg(): Promise<string> {
    if (!cleanArtist) return "";
    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(cleanArtist)}&api_key=${key}&format=json`;
      const res = await fetch(url, { headers: { "User-Agent": "ActionVerse/1.0" } });
      if (!res.ok) return "";
      const data = await res.json();
      return getTrackImageUrl(data?.artist?.image, "");
    } catch { return ""; }
  }

  // Fire both in parallel, pick first non-empty in priority order
  const [trackImg, artistImg] = await Promise.all([getTrackImg(), getArtistImg()]);

  return trackImg || artistImg || FALLBACK_ALBUM_ART;
}


/**
 * Fetch recent scrobbles for a given Last.fm username played AFTER fromUnixTimestamp
 */
export async function fetchUserRecentTracks(
  username: string,
  fromUnixTimestamp?: number
): Promise<LastFmTrack[]> {
  const cleanUsername = (username || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?last\.fm\/user\//i, "")
    .replace(/\/$/, "")
    .trim();

  if (!cleanUsername) return [];

  const apiKey = process.env.NEXT_PUBLIC_LASTFM_API_KEY

  // Add 5-min (300s) buffer for clock skew / join timing
  const bufferedTimestamp = fromUnixTimestamp ? Math.max(0, fromUnixTimestamp - 300) : undefined;
  const fromParam = bufferedTimestamp ? `&from=${bufferedTimestamp}` : "";
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
    cleanUsername
  )}${fromParam}&api_key=${apiKey}&format=json&limit=200`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ActionVerse/1.0" },
    });
    if (!res.ok) {
      throw new Error(`Last.fm API HTTP error! status: ${res.status}`);
    }

    const data = (await res.json()) as LastFmRecentTracksResponse;
    if (data.error) {
      throw new Error(`Last.fm API error: ${data.message}`);
    }

    const rawTrack = data.recenttracks?.track;
    if (!rawTrack) return [];
    return Array.isArray(rawTrack) ? rawTrack : [rawTrack];
  } catch (error) {
    console.error("Error fetching Last.fm recent tracks:", error);
    return [];
  }
}

function normalizeMatchStr(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\(.*?\)|\[.*?\]/g, "") // remove (feat...), [remaster]
    .replace(/[^a-z0-9]/g, "") // keep alpha-numeric only
    .trim();
}

function extractArtistName(scrobbleArtist: any): string {
  if (!scrobbleArtist) return "";
  if (typeof scrobbleArtist === "string") return scrobbleArtist;
  if (typeof scrobbleArtist === "object") {
    return (
      scrobbleArtist["#text"] ||
      scrobbleArtist["name"] ||
      scrobbleArtist["text"] ||
      ""
    );
  }
  return "";
}

function cleanLastFmUrl(url: string): string {
  if (!url) return "";
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(www\.)?last\.fm\/music\//, "")
    .replace(/\/_\//, "/")
    .replace(/\+/g, " ")
    .replace(/%20/g, " ")
    .replace(/\/$/, "");
}

/**
 * Match recent scrobbles against target bounty track guidelines
 */
export function matchScrobblesToTrack(
  scrobbles: LastFmTrack[],
  targetLastFmUrl: string,
  targetTitle: string,
  targetArtist: string
): LastFmTrack[] {
  if (!Array.isArray(scrobbles)) return [];

  const normTargetTitle = normalizeMatchStr(targetTitle);
  const normTargetArtist = normalizeMatchStr(targetArtist);
  const cleanTargetUrl = cleanLastFmUrl(targetLastFmUrl);

  return scrobbles.filter((scrobble) => {
    if (!scrobble || typeof scrobble !== "object") return false;

    const scrobbleTitle = scrobble.name || "";
    const scrobbleArtistName = extractArtistName(scrobble.artist);

    const normScrobbleTitle = normalizeMatchStr(scrobbleTitle);
    const normScrobbleArtist = normalizeMatchStr(scrobbleArtistName);

    // 1. Title + Artist fuzzy/normalized match
    const titleMatch =
      normScrobbleTitle === normTargetTitle ||
      (normScrobbleTitle.length > 2 &&
        normTargetTitle.length > 2 &&
        (normScrobbleTitle.includes(normTargetTitle) ||
          normTargetTitle.includes(normScrobbleTitle)));

    const artistMatch =
      normScrobbleArtist === normTargetArtist ||
      (normScrobbleArtist.length > 2 &&
        normTargetArtist.length > 2 &&
        (normScrobbleArtist.includes(normTargetArtist) ||
          normTargetArtist.includes(normScrobbleArtist)));

    if (titleMatch && artistMatch) return true;

    // 2. Normalized Last.fm URL match
    if (scrobble.url && cleanTargetUrl) {
      const cleanScrobbleUrl = cleanLastFmUrl(scrobble.url);
      if (
        cleanScrobbleUrl &&
        (cleanScrobbleUrl === cleanTargetUrl ||
          cleanScrobbleUrl.includes(cleanTargetUrl) ||
          cleanTargetUrl.includes(cleanScrobbleUrl))
      ) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Search tracks using real Last.fm API method track.search enriched with real album cover artwork
 */
export async function searchLastFmTracks(query: string): Promise<SearchTrackResult[]> {
  const apiKey = process.env.NEXT_PUBLIC_LASTFM_API_KEY;

  if (!query.trim()) return [];

  const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(
    query
  )}&api_key=${apiKey}&format=json&limit=15`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ActionVerse/1.0" },
    });
    if (!res.ok) {
      console.error(`Last.fm search HTTP error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const rawMatches = data?.results?.trackmatches?.track;
    if (!rawMatches) return [];

    const trackMatches = Array.isArray(rawMatches) ? rawMatches : [rawMatches];

    // Return results immediately without blocking on artwork resolution
    // Resolve artwork using Last.fm (track → album → artist → logo), all tiers run in parallel inside fetchTrackArtwork
    return Promise.all(
      trackMatches.map(async (t: any, idx: number) => {
        const imgList = Array.isArray(t.image) ? t.image : [];
        const rawImg = getTrackImageUrl(imgList, FALLBACK_ALBUM_ART);
        const artistName = typeof t.artist === "string" ? t.artist : t.artist?.name || "Unknown Artist";
        const albumArtUrl = await fetchTrackArtwork(artistName, t.name, rawImg, apiKey);

        return {
          id: `search-${idx}-${t.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
          title: t.name,
          artist: artistName,
          album: "Single / Album",
          albumArtUrl,
          durationSec: 180,
          lastFmUrl: t.url || `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(t.name)}`,
        };
      })
    );
  } catch (err) {
    console.error("Error searching Last.fm tracks:", err);
    return [];
  }
}

/**
 * Get top 5 tracks for artist "Three Years Hollow" via real Last.fm API artist.gettoptracks enriched with real album cover artwork
 */
export async function getArtistTopTracks(artistName = "Three Years Hollow"): Promise<SearchTrackResult[]> {
  const apiKey =
    process.env.NEXT_PUBLIC_LASTFM_API_KEY


  const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(
    artistName
  )}&api_key=${apiKey}&format=json&limit=5`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ActionVerse/1.0" },
    });
    if (!res.ok) {
      console.error(`Last.fm gettoptracks HTTP error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const rawTopTracks = data?.toptracks?.track;
    if (!rawTopTracks) return [];

    const topTracks = Array.isArray(rawTopTracks) ? rawTopTracks : [rawTopTracks];

    // Resolve artwork using Last.fm (track → album → artist → logo), all tiers run in parallel inside fetchTrackArtwork
    return Promise.all(
      topTracks.slice(0, 5).map(async (t: any, idx: number) => {
        const imgList = Array.isArray(t.image) ? t.image : [];
        const rawImg = getTrackImageUrl(imgList, FALLBACK_ALBUM_ART);
        const tArtist = typeof t.artist === "string" ? t.artist : t.artist?.name || artistName;
        const albumArtUrl = await fetchTrackArtwork(tArtist, t.name, rawImg, apiKey);

        return {
          id: `artist-${idx}-${t.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
          title: t.name,
          artist: tArtist,
          album: "Popular Track",
          albumArtUrl,
          durationSec: 210,
          lastFmUrl: t.url || `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(t.name)}`,
        };
      })
    );
  } catch (err) {
    console.error("Error fetching artist top tracks from Last.fm:", err);
    return [];
  }
}
