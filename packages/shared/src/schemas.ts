import { z } from 'zod';

export const JoinSessionSchema = z.object({
  code: z
    .string()
    .min(6)
    .max(6)
    .regex(/^[A-Z0-9]+$/),
  name: z.string().min(1).max(50).trim(),
});

export const CreateSessionSchema = z.object({
  scenarioId: z.string().min(1),
  pin: z
    .string()
    .min(4)
    .max(8)
    .regex(/^\d+$/),
});

export const FacilitatorAuthSchema = z.object({
  sessionId: z.string().uuid(),
  pin: z.string().min(4).max(8),
});

export const AssignPatientSchema = z.object({
  userId: z.string().uuid(),
  patientId: z.string().uuid(),
});

export const FluidPrescriptionSchema = z.object({
  type: z.literal('iv_fluids'),
  durationMinutes: z.number().min(15).max(240),
});

export const InsulinPrescriptionSchema = z.object({
  type: z.literal('insulin'),
  rateMlPerHr: z.number().min(1.0).max(15.0),
});

export const PotassiumPrescriptionSchema = z.object({
  type: z.literal('potassium'),
  concentrationMmol: z.number().min(0).max(40),
});

export const PrescriptionSchema = z.discriminatedUnion('type', [
  FluidPrescriptionSchema,
  InsulinPrescriptionSchema,
  PotassiumPrescriptionSchema,
]);

export const SubmitActionSchema = z.object({
  patientId: z.string().uuid(),
  actionKey: z.string().min(1),
  prescription: PrescriptionSchema.optional(),
});

export const ToggleResourceSchema = z.object({
  sessionId: z.string().uuid(),
  resource: z.enum(['ketometer', 'labs', 'staff']),
  available: z.boolean(),
});

export const InjectEventSchema = z.object({
  sessionId: z.string().uuid(),
  event: z.object({
    type: z.enum(['resource_change', 'message', 'staff_change']),
    message: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
  }),
});
