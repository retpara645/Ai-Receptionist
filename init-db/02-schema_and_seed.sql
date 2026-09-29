-- Connect to the klinik_db to create schema
\c klinik_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: clinics
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    clinic_type VARCHAR(50) NOT NULL CHECK (clinic_type IN ('aesthetic', 'dental')),
    address TEXT,
    operating_hours TEXT
);

-- Table: services
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_duration_minutes INTEGER,
    estimated_price NUMERIC(10, 2)
);

-- Table: doctors
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(100) NOT NULL CHECK (title IN ('dokter estetika', 'dokter gigi', 'terapis'))
);

-- Table: doctor_schedules
CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

-- Table: bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    service_id UUID REFERENCES services(id),
    doctor_id UUID REFERENCES doctors(id),
    booking_datetime TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_doctor_slot UNIQUE (doctor_id, booking_datetime)
);

-- Table: chat_sessions (for Memory Agent)
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    history JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_sender_channel UNIQUE (sender_id, channel)
);

-- Seed Data: Glow Aesthetic Clinic
INSERT INTO clinics (id, name, clinic_type, address, operating_hours) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Glow Aesthetic Clinic', 'aesthetic', 'Jl. Sudirman No. 10, Jakarta', 'Senin - Sabtu: 09:00 - 20:00');

INSERT INTO services (id, clinic_id, service_name, description, estimated_duration_minutes, estimated_price) VALUES 
('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Facial Basic', 'Perawatan wajah dasar untuk membersihkan dan menyegarkan kulit.', 60, 250000),
('21111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Chemical Peeling', 'Pengelupasan sel kulit mati untuk kulit lebih cerah.', 45, 450000),
('21111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'Botox & Filler', 'Injeksi kecantikan untuk menghilangkan kerutan.', 30, 2000000),
('21111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', 'Laser Hair Removal', 'Menghilangkan bulu halus secara permanen.', 60, 800000),
('21111111-1111-1111-1111-111111111115', '11111111-1111-1111-1111-111111111111', 'Konsultasi Dokter Estetika', 'Konsultasi dengan dokter ahli kecantikan.', 30, 150000);

INSERT INTO doctors (id, clinic_id, name, title) VALUES
('31111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'dr. Sarah Glow', 'dokter estetika'),
('31111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Terapis Rina', 'terapis');

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES
('31111111-1111-1111-1111-111111111111', 'Senin', '09:00', '15:00'),
('31111111-1111-1111-1111-111111111111', 'Rabu', '09:00', '15:00'),
('31111111-1111-1111-1111-111111111111', 'Jumat', '09:00', '15:00'),
('31111111-1111-1111-1111-111111111112', 'Senin', '13:00', '20:00'),
('31111111-1111-1111-1111-111111111112', 'Selasa', '09:00', '17:00'),
('31111111-1111-1111-1111-111111111112', 'Sabtu', '09:00', '20:00');

-- Seed Data: Smile Dental Care
INSERT INTO clinics (id, name, clinic_type, address, operating_hours) 
VALUES ('12222222-2222-2222-2222-222222222222', 'Smile Dental Care', 'dental', 'Jl. Kemang Raya No. 45, Jakarta', 'Senin - Minggu: 10:00 - 21:00');

INSERT INTO services (id, clinic_id, service_name, description, estimated_duration_minutes, estimated_price) VALUES 
('22222222-2222-2222-2222-222222222221', '12222222-2222-2222-2222-222222222222', 'Scaling', 'Pembersihan karang gigi secara menyeluruh.', 45, 300000),
('22222222-2222-2222-2222-222222222222', '12222222-2222-2222-2222-222222222222', 'Cabut Gigi', 'Pencabutan gigi berlubang atau bermasalah.', 60, 500000),
('22222222-2222-2222-2222-222222222223', '12222222-2222-2222-2222-222222222222', 'Tambal Gigi', 'Penambalan gigi berlubang.', 45, 400000),
('22222222-2222-2222-2222-222222222224', '12222222-2222-2222-2222-222222222222', 'Pasang Behel', 'Pemasangan kawat gigi untuk merapikan gigi.', 120, 5000000),
('22222222-2222-2222-2222-222222222225', '12222222-2222-2222-2222-222222222222', 'Veneer', 'Perbaikan estetika gigi dengan lapisan khusus.', 90, 3000000),
('22222222-2222-2222-2222-222222222226', '12222222-2222-2222-2222-222222222222', 'Konsultasi Dokter Gigi', 'Pemeriksaan dasar dan konsultasi kesehatan gigi.', 30, 200000);

INSERT INTO doctors (id, clinic_id, name, title) VALUES
('32222222-2222-2222-2222-222222222221', '12222222-2222-2222-2222-222222222222', 'drg. Budi Smile', 'dokter gigi'),
('32222222-2222-2222-2222-222222222222', '12222222-2222-2222-2222-222222222222', 'drg. Ayu Lestari', 'dokter gigi');

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES
('32222222-2222-2222-2222-222222222221', 'Senin', '10:00', '18:00'),
('32222222-2222-2222-2222-222222222221', 'Kamis', '10:00', '18:00'),
('32222222-2222-2222-2222-222222222221', 'Sabtu', '10:00', '15:00'),
('32222222-2222-2222-2222-222222222222', 'Selasa', '13:00', '21:00'),
('32222222-2222-2222-2222-222222222222', 'Rabu', '13:00', '21:00'),
('32222222-2222-2222-2222-222222222222', 'Minggu', '10:00', '21:00');
