interface RegisterBadgeParams {
  type: string;
  name: string;
  description: string;
}

export function registerCustomBadge(params: RegisterBadgeParams) {
  const windowWithCards = window as unknown as Window & {
      customBadges: unknown[];
  }
  windowWithCards.customBadges = windowWithCards.customBadges || [];

  windowWithCards.customBadges.push({
      ...params,
      preview: true,
      documentationURL: `https://github.com/selvalt7/modern-circular-gauge`,
  })
}
