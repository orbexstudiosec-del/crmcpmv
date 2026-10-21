import { PrismaService } from '../../prisma/prisma.service';

const DIAS_JS: Record<string, number> = { DOM: 0, LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5, SAB: 6 };

/** Calcula los próximos huecos libres para un nodo `scheduleBooking`: recorre los próximos
 * `diasAdelante` días, solo los días de la semana configurados, en pasos de `duracionMinutos`
 * dentro de `[horaInicio, horaFin)`, descarta los que ya pasaron y los que chocan con una
 * `Actividad` tipo REUNION ya existente de la organización. */
export async function calcularSlotsDisponibles(
  prisma: PrismaService,
  organizationId: string,
  data: { dias: string[]; horaInicio: string; horaFin: string; duracionMinutos: number },
  diasAdelante = 14,
  maxSlots = 8,
): Promise<Date[]> {
  const diasPermitidos = new Set(data.dias.map((d) => DIAS_JS[d]).filter((v) => v !== undefined));
  const [hIni, mIni] = data.horaInicio.split(':').map(Number);
  const [hFin, mFin] = data.horaFin.split(':').map(Number);
  const duracionMs = data.duracionMinutos * 60_000;
  const ahora = new Date();

  const desde = new Date(ahora);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + diasAdelante);

  const ocupadas = await prisma.actividad.findMany({
    where: {
      organizationId, tipo: 'REUNION',
      inicio: { gte: desde, lt: hasta },
    },
    select: { inicio: true, vencimiento: true },
  });

  const slots: Date[] = [];
  for (let dia = 0; dia < diasAdelante && slots.length < maxSlots; dia++) {
    const fecha = new Date(desde);
    fecha.setDate(fecha.getDate() + dia);
    if (!diasPermitidos.has(fecha.getDay())) continue;

    for (
      let cursor = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), hIni, mIni || 0);
      cursor.getHours() < hFin || (cursor.getHours() === hFin && cursor.getMinutes() < (mFin || 0));
      cursor = new Date(cursor.getTime() + duracionMs)
    ) {
      if (cursor <= ahora) continue;
      const fin = new Date(cursor.getTime() + duracionMs);
      const choca = ocupadas.some((o) => o.inicio && o.vencimiento && cursor < o.vencimiento && fin > o.inicio);
      if (!choca) slots.push(new Date(cursor));
      if (slots.length >= maxSlots) break;
    }
  }
  return slots;
}
