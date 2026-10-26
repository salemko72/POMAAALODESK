import { buildDefaultCleaningTask, createCleaningTask } from './cleaning-repository'
import { createReservation, deleteReservation, type CreateReservationInput, type Reservation } from './reservations-repository'

export async function createReservationWithCleaning(
  reservation: CreateReservationInput,
  cleaningDurationMinutes: number,
): Promise<{ reservation: Reservation; cleaningTask: Awaited<ReturnType<typeof createCleaningTask>> }> {
  const created = await createReservation(reservation)
  try {
    const task = await createCleaningTask(buildDefaultCleaningTask({
      reservationId: created.id,
      propertyId: created.property_id,
      checkout: created.check_out,
      cleaningDurationMinutes,
    }))
    return { reservation: created, cleaningTask: task }
  } catch (error) {
    try { await deleteReservation(created.id) } catch { /* keep original error */ }
    throw error
  }
}
