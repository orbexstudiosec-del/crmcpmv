/** Categorías con las que arranca el cronopost de una organización nueva (las existentes las
 *  recibieron en la migración 20261028100000_categorias_cronopost). Se pueden editar o borrar. */
export const CATEGORIAS_INICIALES = [
  { nombre: 'Crédito', color: '#2a78d6', descripcion: 'Productos de crédito: consumo, microcrédito, vivienda; requisitos y beneficios.', orden: 1 },
  { nombre: 'Inversiones', color: '#16a34a', descripcion: 'Ahorro e inversión: depósitos a plazo fijo, ahorro programado, rendimientos.', orden: 2 },
  { nombre: 'Seguridad', color: '#e0433d', descripcion: 'Prevención de estafas y fraudes, cuidado de claves y canales oficiales.', orden: 3 },
  { nombre: 'Educación financiera', color: '#7c5cfc', descripcion: 'Consejos prácticos de presupuesto, ahorro y manejo de deudas.', orden: 4 },
  { nombre: 'Institucional', color: '#eda100', descripcion: 'Noticias, aniversarios, agencias, comunidad y responsabilidad social.', orden: 5 },
];
