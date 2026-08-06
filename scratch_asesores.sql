-- ============================================
-- PASO 1: Crear las 2 sedes que faltan
-- (No tengo direccion/telefono/coordenadas reales de estas, quedan en null;
--  no llevan "Vitrina" en servicios porque no son puntos de venta fisicos
--  donde el cliente elige hacer la prueba, son grupos de asesores internos.
--  Ajusta si quieres agregarles direccion/telefono despues.)
-- ============================================

insert into sedes (nombre, ciudad, activa, servicios)
values
    ('Distrikia Corporativos', 'Medellín', true, '{}'),
    ('Distrikia Sala Móvil - Digital', 'Medellín', true, '{}');

-- ============================================
-- PASO 2: Insertar los 49 asesores
-- Fuente: hoja "BD" del Excel "Lista Asesores Test Drive.xlsx"
-- Fotos: no se incluyen (foto_url queda null), se agregan despues manualmente
-- ============================================

insert into asesores (nombre, sede_id, activo) values ('Gil Bernal Eliana', (select id from sedes where nombre = 'Distrikia Apartadó'), true);
insert into asesores (nombre, sede_id, activo) values ('Alzate Gallego Banderley', (select id from sedes where nombre = 'Distrikia Apartadó'), true);
insert into asesores (nombre, sede_id, activo) values ('Quiroz Henao Santiago', (select id from sedes where nombre = 'Distrikia La 10'), true);
insert into asesores (nombre, sede_id, activo) values ('Avendaño Tamayo Jhon Bayron', (select id from sedes where nombre = 'Distrikia La 10'), true);
insert into asesores (nombre, sede_id, activo) values ('Serna Sierra Oscar Andres', (select id from sedes where nombre = 'Distrikia La 10'), true);
insert into asesores (nombre, sede_id, activo) values ('Grajales Muñoz Juvenal', (select id from sedes where nombre = 'Distrikia La 10'), true);
insert into asesores (nombre, sede_id, activo) values ('Posso Zabala Erika Andrea', (select id from sedes where nombre = 'Distrikia La 10'), true);
insert into asesores (nombre, sede_id, activo) values ('Jaramillo Castañeda Cindy Vanesa', (select id from sedes where nombre = 'Distrikia La 10'), true);
insert into asesores (nombre, sede_id, activo) values ('Echeverri Alina Maria', (select id from sedes where nombre = 'Distrikia La 10'), true);
insert into asesores (nombre, sede_id, activo) values ('Velez Quintero Sandra Milena', (select id from sedes where nombre = 'Distrikia La 10'), true);
insert into asesores (nombre, sede_id, activo) values ('Lopez Echeverry John Deivid', (select id from sedes where nombre = 'Distrikia Llanogrande'), true);
insert into asesores (nombre, sede_id, activo) values ('Garces Vallejo Mateo', (select id from sedes where nombre = 'Distrikia Llanogrande'), true);
insert into asesores (nombre, sede_id, activo) values ('Ocampo Correa Laura Andrea', (select id from sedes where nombre = 'Distrikia Llanogrande'), true);
insert into asesores (nombre, sede_id, activo) values ('Gil Perez Rosa Yamaris', (select id from sedes where nombre = 'Distrikia Llanogrande'), true);
insert into asesores (nombre, sede_id, activo) values ('Sanchez Zuluaga Carolina', (select id from sedes where nombre = 'Distrikia Llanogrande'), true);
insert into asesores (nombre, sede_id, activo) values ('Palechor Tovar Maria Angelica', (select id from sedes where nombre = 'Distrikia Llanogrande'), true);
insert into asesores (nombre, sede_id, activo) values ('Lozano Pacheco Victor Alfonso', (select id from sedes where nombre = 'Distrikia Montería'), true);
insert into asesores (nombre, sede_id, activo) values ('Guzman Florez Viviana Patricia', (select id from sedes where nombre = 'Distrikia Montería'), true);
insert into asesores (nombre, sede_id, activo) values ('Tobio Payares Dana', (select id from sedes where nombre = 'Distrikia Montería'), true);
insert into asesores (nombre, sede_id, activo) values ('Acosta Medina Wendy Estefany', (select id from sedes where nombre = 'Distrikia Montería'), true);
insert into asesores (nombre, sede_id, activo) values ('Rojas Hernandez Olga Patricia', (select id from sedes where nombre = 'Distrikia Montería'), true);
insert into asesores (nombre, sede_id, activo) values ('Goyeneche Cuesta Jhony Humberto', (select id from sedes where nombre = 'Distrikia Montería'), true);
insert into asesores (nombre, sede_id, activo) values ('Berastegui Garcia Zaira Salome', (select id from sedes where nombre = 'Distrikia Montería'), true);
insert into asesores (nombre, sede_id, activo) values ('Vergara Gallego Daniel Ricardo', (select id from sedes where nombre = 'Distrikia Palacé'), true);
insert into asesores (nombre, sede_id, activo) values ('Rojas Angel Carlos Brayan', (select id from sedes where nombre = 'Distrikia Palacé'), true);
insert into asesores (nombre, sede_id, activo) values ('Madrigal Juan Camilo', (select id from sedes where nombre = 'Distrikia Palacé'), true);
insert into asesores (nombre, sede_id, activo) values ('Villada Gomez Liseth Katherine', (select id from sedes where nombre = 'Distrikia Palacé'), true);
insert into asesores (nombre, sede_id, activo) values ('Arbelaez Cano Katerine Yelena', (select id from sedes where nombre = 'Distrikia Palacé'), true);
insert into asesores (nombre, sede_id, activo) values ('Lopez Bello Lucelys Elena', (select id from sedes where nombre = 'Distrikia Palacé'), true);
insert into asesores (nombre, sede_id, activo) values ('Urrego Higuita Paola Andrea', (select id from sedes where nombre = 'Distrikia Palacé'), true);
insert into asesores (nombre, sede_id, activo) values ('Ruiz Henao Manuel Salvador', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Bocanegra Sarmiento Ivonne Juliet', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Bedoya Gutierrez Diana Maria', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Martinez Rios Yeison', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Ruiz Hernandez Oscar Dario', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Zuleta Hincapie Daniel Antonio', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Agudelo Suaza Nodier Esneyder', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Santamaria Marin Diana Carolina', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Usuga Aristizabal Heidy Johana', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Salazar Rodriguez Camilo Andres', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Pineda Gonzalez Sergio Daniel', (select id from sedes where nombre = 'Distrikia Premium'), true);
insert into asesores (nombre, sede_id, activo) values ('Cifuentes Quijano Sara Cristina', (select id from sedes where nombre = 'Distrikia Sala Móvil - Digital'), true);
insert into asesores (nombre, sede_id, activo) values ('Carmona Correa Alejandra Maria', (select id from sedes where nombre = 'Distrikia Sala Móvil - Digital'), true);
insert into asesores (nombre, sede_id, activo) values ('Sanchez Silva Valentina', (select id from sedes where nombre = 'Distrikia Sala Móvil - Digital'), true);
insert into asesores (nombre, sede_id, activo) values ('Manuela Vanegas López', (select id from sedes where nombre = 'Distrikia Sala Móvil - Digital'), true);
insert into asesores (nombre, sede_id, activo) values ('Diaz Bernal Ruben Daniel', (select id from sedes where nombre = 'Distrikia Sincelejo'), true);
insert into asesores (nombre, sede_id, activo) values ('Betin Lobo Samira Del Socorro', (select id from sedes where nombre = 'Distrikia Sincelejo'), true);
insert into asesores (nombre, sede_id, activo) values ('Coneo Villafañe Huber Jose', (select id from sedes where nombre = 'Distrikia Sincelejo'), true);
insert into asesores (nombre, sede_id, activo) values ('Suarez Higuita Katerin Yulieth', (select id from sedes where nombre = 'Distrikia Corporativos'), true);
