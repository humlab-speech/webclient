/**
 * Where Tratt is served: `<subdomain>.<this host>`. The subdomain is the
 * deployment's TRATT_SUBDOMAIN (index.php puts it in window.vispConfig), the
 * same variable the Apache vhost is named by, so sites that kept the old
 * `octra.` name launch Tratt there too.
 */
export function trattSubdomain(config:any = (window as any).vispConfig):string {
  const value = typeof config?.trattSubdomain === "string" ? config.trattSubdomain : "";
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(value) ? value : "tratt";
}

/** Tratt's origin for the page's host, e.g. https://tratt.visp.example.org */
export function trattOrigin(location:{ protocol:string, hostname:string } = window.location, config?:any):string {
  return location.protocol + "//" + trattSubdomain(config ?? (window as any).vispConfig) + "." + location.hostname;
}
