const euroFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const formatEuro = (value: number) => euroFormat.format(value);

/** "040 / 52 90 1000" -> "tel:+494052901000" */
export const telHref = (phone: string) => `tel:+49${phone.replace(/\D/g, '').replace(/^0/, '')}`;

export const isExternal = (href: string) => /^https?:\/\//.test(href);
