-- Datos DEMO para probar el panel. Opcional.
-- Son empresas ficticias marcadas con is_demo = true y el prefijo "DEMO".
-- Sin emails, teléfonos ni contactos inventados.
-- Para borrarlas cuando empecéis con datos reales:
--   delete from public.companies where is_demo;

insert into public.companies
  (name, sector, city, recommended_service, problem, opportunity, priority, potential_value, status, next_follow_up_at, follow_up_note, is_demo)
values
  ('DEMO · Estudio de arquitectura', 'Arquitectura', 'Barcelona', 'Web Corporativa',
   'Web antigua, no adaptada a móvil', 'Portfolio de proyectos sin presentar online', 'alta', 1200, 'auditado',
   current_date, 'Preparar primer email con la auditoría', true),
  ('DEMO · Clínica dental', 'Clínicas', 'Barcelona', 'SEO',
   'No aparece en búsquedas locales', 'SEO local en su barrio', 'media', null, 'contactado',
   current_date + 3, 'Segundo seguimiento si no responde', true),
  ('DEMO · Restaurante', 'Restauración', 'Barcelona', 'Growth (Redes)',
   'Instagram sin publicar desde hace meses', 'Contenido de platos y equipo', 'media', 500, 'reunion',
   current_date + 1, 'Reunión de presentación', true),
  ('DEMO · Inmobiliaria', 'Inmobiliario', 'Barcelona', 'Web Corporativa',
   'Formulario de contacto roto', 'Captación de propietarios', 'alta', 1200, 'propuesta',
   current_date - 2, 'Llamar para resolver dudas de la propuesta', true),
  ('DEMO · Tienda de diseño', 'Retail', 'Barcelona', 'Ecommerce',
   'Sin tienda online', 'Venta online del catálogo', 'baja', 2000, 'nuevo',
   null, null, true);
