export type ChargeProduct = {
  id: string;
  bananas: number;
  bonusBananas?: number;
  priceWon: number;
};

export const chargeProducts: ChargeProduct[] = [
  { id: "p1", bananas: 2000, priceWon: 2800 },
  { id: "p2", bananas: 4900, priceWon: 6900 },
  { id: "p3", bananas: 9600, bonusBananas: 400, priceWon: 13500 },
  { id: "p4", bananas: 28000, bonusBananas: 2000, priceWon: 39000 },
  { id: "p5", bananas: 46000, bonusBananas: 4000, priceWon: 64000 },
  { id: "p6", bananas: 90000, bonusBananas: 10000, priceWon: 126000 },
];

