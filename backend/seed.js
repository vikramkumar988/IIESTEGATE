const bcrypt = require('bcryptjs');
const pool = require('./config/db');
const { saltRounds } = require('./config/auth');
const fs = require('fs');
const path = require('path');

const seedDatabase = async () => {
  try {
    console.log('🔧 Running database schema...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schemaSQL);
    console.log('✅ Schema created successfully');

    console.log('🌱 Seeding users...');

    const users = [
      { full_name: 'Admin User', email: 'admin@iiest.ac.in', phone: '9000000001', password: 'admin123', role: 'admin', organization: 'iiest', department: 'Administration', designation: 'System Administrator' },
      { full_name: 'Rajesh Kumar', email: 'guard1@iiest.ac.in', phone: '9000000002', password: 'guard123', role: 'guard', organization: 'iiest', designation: 'Security Guard', gate_assigned: 'Main Gate' },
      { full_name: 'Suresh Singh', email: 'guard2@iiest.ac.in', phone: '9000000003', password: 'guard123', role: 'guard', organization: 'iiest', designation: 'Security Guard', gate_assigned: 'Side Gate' },
      { full_name: 'Prof. Amit Sharma', email: 'amit.sharma@iiest.ac.in', phone: '9000000004', password: 'staff123', role: 'staff', organization: 'iiest', department: 'Computer Science', designation: 'Professor' },
      { full_name: 'Prof. Priya Das', email: 'priya.das@iiest.ac.in', phone: '9000000005', password: 'staff123', role: 'staff', organization: 'iiest', department: 'Electronics', designation: 'Associate Professor' },
      { full_name: 'Prof. Rahul Gupta', email: 'rahul.gupta@iiest.ac.in', phone: '9000000006', password: 'staff123', role: 'staff', organization: 'iiest', department: 'Mechanical Engineering', designation: 'Professor' },
      { full_name: 'Dr. Sneha Roy', email: 'sneha.roy@iiest.ac.in', phone: '9000000007', password: 'staff123', role: 'staff', organization: 'iiest', department: 'Civil Engineering', designation: 'Assistant Professor' },
      { full_name: 'Prof. Vikram Patel', email: 'vikram.patel@iiest.ac.in', phone: '9000000008', password: 'staff123', role: 'staff', organization: 'iiest', department: 'Computer Science', designation: 'HOD' },
    ];

    for (const user of users) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
      if (existing.rows.length > 0) {
        console.log(`  ⏭️  User ${user.email} already exists, skipping.`);
        continue;
      }

      const password_hash = await bcrypt.hash(user.password, saltRounds);
      await pool.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, organization, department, designation, gate_assigned, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
        [user.full_name, user.email, user.phone, password_hash, user.role, user.organization, user.department, user.designation, user.gate_assigned || null]
      );
      console.log(`  ✅ Created ${user.role}: ${user.full_name} (${user.email})`);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('  Admin:  admin@iiest.ac.in / admin123');
    console.log('  Guard:  guard1@iiest.ac.in / guard123');
    console.log('  Guard:  guard2@iiest.ac.in / guard123');
    console.log('  Staff:  amit.sharma@iiest.ac.in / staff123');
    console.log('  Staff:  priya.das@iiest.ac.in / staff123');
    console.log('  Staff:  rahul.gupta@iiest.ac.in / staff123');
    console.log('  Staff:  sneha.roy@iiest.ac.in / staff123');
    console.log('  Staff:  vikram.patel@iiest.ac.in / staff123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
