/**
 * Strips the IPv6-mapped IPv4 prefix so that `::ffff:192.168.1.1` and
 * `192.168.1.1` compare as equal. Pure IPv6 addresses are returned unchanged.
 */
export function normalizeIp(ip: string): string {
  const match = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return match ? match[1] : ip;
}
