// Site-wide settings. Empty social entries are rendered as non-clickable
// "coming soon" items.
export const SITE = {
  url: 'https://programmingworlds.vercel.app',
  email: 'programmingworld2030@gmail.com', // destination of the contact form (see api/contact.js)
  socials: {
    instagram: '',
    x: '',
    youtube: '',
    linkedin: '',
  },
};

// Verified real projects only. Screenshots in public/projects/ are captured
// from the live sites with `npm run capture:projects`.
// `embeddable`: the site sends no X-Frame-Options / frame-ancestors header,
// so it can be shown live inside the device frame (re-check when adding one).
export const PROJECTS = [
  {
    id: 'oishi-mochi',
    url: 'https://oishimochijo.vercel.app/',
    embeddable: true,
    name: { en: 'Oishi Mochi', ar: 'Oishi Mochi' },
    tagline: { en: 'عالم من النكهة', ar: 'عالم من النكهة' },
    category: { en: 'Brand experience · Amman', ar: 'تجربة علامة تجارية · عمّان' },
    desc: {
      en: 'A premium mochi ice cream experience in Amman, featuring an immersive visual journey through flavors and product boxes.',
      ar: 'تجربة فاخرة لموتشي الآيس كريم في عمّان، مع رحلة بصرية غامرة بين النكهات وعلب المنتجات.',
    },
  },
  {
    id: 'stop-burger',
    url: 'https://eatstopjo.vercel.app/',
    embeddable: true,
    name: { en: 'Stop Burger', ar: 'Stop Burger' },
    tagline: { en: 'ستوب برجر', ar: 'ستوب برجر' },
    category: { en: 'Restaurant website · Amman', ar: 'موقع مطعم · عمّان' },
    desc: {
      en: 'A burger and fast-food website featuring smash burgers, hot dogs, and milkshakes in Amman.',
      ar: 'موقع لمطعم برجر ووجبات سريعة في عمّان، يقدّم السماش برجر والهوت دوغ والميلك شيك.',
    },
  },
];
