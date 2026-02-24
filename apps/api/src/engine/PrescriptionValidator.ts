import type {
  Prescription,
  PrescriptionFeedback,
  PrescriptionAccuracy,
  ClinicalRulesConfig,
  Patient,
} from '@dka-sim/shared';

interface ValidationResult {
  feedback: PrescriptionFeedback;
  interventionScale: number; // 0.0 = no effect, 1.0 = full effect
}

/**
 * Validate a fluid prescription (1000ml 0.9% NaCl bag 1 duration).
 * NHS DKA pathway: non-shocked (SBP > 90) = 1000ml over 60 minutes.
 */
function validateFluidPrescription(
  durationMinutes: number,
  patient: Patient,
  config: ClinicalRulesConfig,
): ValidationResult {
  const target = config.treatment.fluidProtocol.firstBagDurationMinutes; // 60
  const diff = Math.abs(durationMinutes - target);

  let accuracy: PrescriptionAccuracy;
  let feedback: string;
  let interventionScale: number;

  if (diff <= 15) {
    // 45–75 min
    accuracy = 'correct';
    feedback = `Correct — 1000ml 0.9% NaCl over ${durationMinutes} minutes (protocol: ${target} min for SBP > ${config.treatment.fluidProtocol.sbpShockedThreshold}).`;
    interventionScale = 1.0;
  } else if (durationMinutes >= 30 && durationMinutes <= 120) {
    // 30–44 or 76–120 min
    accuracy = 'acceptable';
    feedback = `Acceptable — protocol recommends ${target} minutes for the first bag (SBP > ${config.treatment.fluidProtocol.sbpShockedThreshold}). You prescribed ${durationMinutes} min.`;
    interventionScale = 0.7;
  } else if (durationMinutes < 30) {
    // Too fast — risk of fluid overload
    accuracy = 'dangerous';
    feedback = `Too fast — ${durationMinutes} min risks fluid overload, especially in pregnancy. Protocol: ${target} min for non-shocked patients.`;
    interventionScale = 0.0;
  } else {
    // > 120 min — too slow
    accuracy = 'incorrect';
    feedback = `Too slow — ${durationMinutes} min will delay resuscitation. Protocol: ${target} min for the first bag.`;
    interventionScale = 0.3;
  }

  return {
    feedback: {
      accuracy,
      expectedValue: `${target} minutes`,
      feedback,
    },
    interventionScale,
  };
}

/**
 * Validate an insulin prescription (FRII rate in ml/hr).
 * NHS DKA pathway: 0.1 units/kg/hr, max 15 ml/hr.
 * Preparation: 50 units Actrapid in 50ml 0.9% NaCl = 1 unit/ml.
 * So rate in ml/hr = rate in units/hr = weight × 0.1.
 */
function validateInsulinPrescription(
  rateMlPerHr: number,
  patient: Patient,
  config: ClinicalRulesConfig,
): ValidationResult {
  const correctRate = Math.min(
    Math.round(patient.weight * config.treatment.insulinProtocol.rateUnitsPerKgPerHr * 10) / 10,
    config.treatment.insulinProtocol.maxRateMlPerHr,
  );
  const diff = Math.abs(rateMlPerHr - correctRate);

  let accuracy: PrescriptionAccuracy;
  let feedback: string;
  let interventionScale: number;

  if (diff <= 0.2) {
    accuracy = 'correct';
    feedback = `Correct — ${patient.weight}kg × 0.1 units/kg/hr = ${correctRate} ml/hr. You prescribed ${rateMlPerHr} ml/hr.`;
    interventionScale = 1.0;
  } else if (diff <= 1.0) {
    accuracy = 'acceptable';
    feedback = `Close — correct rate is ${correctRate} ml/hr (${patient.weight}kg × 0.1). You prescribed ${rateMlPerHr} ml/hr.`;
    interventionScale = 0.7;
  } else if (diff <= 2.0) {
    accuracy = 'incorrect';
    feedback = `Incorrect — correct rate is ${correctRate} ml/hr (${patient.weight}kg × 0.1 units/kg/hr). You prescribed ${rateMlPerHr} ml/hr.`;
    interventionScale = 0.3;
  } else {
    accuracy = 'dangerous';
    feedback = rateMlPerHr > correctRate
      ? `Dangerous — ${rateMlPerHr} ml/hr is significantly too high. Risk of severe hypoglycaemia. Correct: ${correctRate} ml/hr (${patient.weight}kg × 0.1).`
      : `Dangerous — ${rateMlPerHr} ml/hr is significantly too low. Inadequate treatment. Correct: ${correctRate} ml/hr (${patient.weight}kg × 0.1).`;
    interventionScale = 0.0;
  }

  return {
    feedback: {
      accuracy,
      expectedValue: `${correctRate} ml/hr`,
      feedback,
    },
    interventionScale,
  };
}

/**
 * Validate a potassium prescription (KCl concentration in mmol/L).
 * NHS DKA pathway:
 *   K+ < 3.5: 40 mmol/L KCl (senior review needed)
 *   K+ 3.5–5.5: 20 mmol/L KCl (standard)
 *   K+ > 5.5: No KCl (0 mmol/L)
 */
function validatePotassiumPrescription(
  concentrationMmol: number,
  patient: Patient,
  config: ClinicalRulesConfig,
): ValidationResult {
  const k = patient.lastKnownPotassium;
  if (k === undefined) {
    return {
      feedback: {
        accuracy: 'incorrect',
        expectedValue: 'Check K+ first',
        feedback: 'Potassium level not yet known — check serum K+ before prescribing replacement.',
      },
      interventionScale: 0.3,
    };
  }

  const lowThreshold = config.treatment.potassiumProtocol.lowThreshold;
  const highThreshold = config.treatment.potassiumProtocol.highThreshold;

  let correctConcentration: number;
  let bandDescription: string;
  if (k < lowThreshold) {
    correctConcentration = 40;
    bandDescription = `K+ ${k} mmol/L (< ${lowThreshold}) — 40 mmol/L KCl with senior review`;
  } else if (k <= highThreshold) {
    correctConcentration = 20;
    bandDescription = `K+ ${k} mmol/L (${lowThreshold}–${highThreshold}) — 20 mmol/L KCl`;
  } else {
    correctConcentration = 0;
    bandDescription = `K+ ${k} mmol/L (> ${highThreshold}) — no KCl needed`;
  }

  let accuracy: PrescriptionAccuracy;
  let feedback: string;
  let interventionScale: number;

  if (concentrationMmol === correctConcentration) {
    accuracy = 'correct';
    feedback = `Correct — ${bandDescription}. You prescribed ${concentrationMmol} mmol/L.`;
    interventionScale = 1.0;
  } else if (
    // Adjacent band (off by one step)
    Math.abs(concentrationMmol - correctConcentration) <= 20
  ) {
    accuracy = 'acceptable';
    feedback = `Close — ${bandDescription}. You prescribed ${concentrationMmol} mmol/L.`;
    interventionScale = 0.5;
  } else if (
    // Dangerous: giving KCl when K+ is high, or no KCl when K+ is critically low
    (k > highThreshold && concentrationMmol > 0) ||
    (k < lowThreshold && concentrationMmol === 0)
  ) {
    accuracy = 'dangerous';
    feedback = k > highThreshold
      ? `Dangerous — K+ is ${k} mmol/L (> ${highThreshold}). Giving KCl risks hyperkalaemia and cardiac arrest.`
      : `Dangerous — K+ is ${k} mmol/L (< ${lowThreshold}). Withholding replacement risks severe hypokalaemia.`;
    interventionScale = 0.0;
  } else {
    accuracy = 'incorrect';
    feedback = `Incorrect — ${bandDescription}. You prescribed ${concentrationMmol} mmol/L.`;
    interventionScale = 0.3;
  }

  return {
    feedback: {
      accuracy,
      expectedValue: `${correctConcentration} mmol/L`,
      feedback,
    },
    interventionScale,
  };
}

/**
 * Validate any prescription and return feedback + intervention scaling.
 */
export function validatePrescription(
  prescription: Prescription,
  patient: Patient,
  config: ClinicalRulesConfig,
): ValidationResult {
  switch (prescription.type) {
    case 'iv_fluids':
      return validateFluidPrescription(prescription.durationMinutes, patient, config);
    case 'insulin':
      return validateInsulinPrescription(prescription.rateMlPerHr, patient, config);
    case 'potassium':
      return validatePotassiumPrescription(prescription.concentrationMmol, patient, config);
  }
}
