import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Booking } from './Booking';

@Entity('zoom_accounts')
export class ZoomAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  label!: string; // e.g. "Cuenta 1", "Prof. Garcia"

  @Column({ nullable: true })
  email!: string; // Zoom email associated

  @Column({ nullable: true })
  zoomUserId!: string; // Zoom user ID ( zak / PMI )

  @Column({ default: true })
  isActive!: boolean; // enable/disable this account

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Booking, (booking) => booking.zoomAccount)
  bookings!: Booking[];
}
