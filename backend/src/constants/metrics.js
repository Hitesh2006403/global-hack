// Conversion multipliers to standardize different food donation units into "meals saved"
const MEAL_CONVERSION_RATIOS = Object.freeze({
  plates: 1.0,     // 1 plate = 1 meal
  servings: 1.0,   // 1 serving = 1 meal
  packets: 1.0,    // 1 packet = 1 meal
  kg: 2.5,         // 1 kg = 2.5 meals (standard 400g nutrition baseline)
});

module.exports = {
  MEAL_CONVERSION_RATIOS,
};
