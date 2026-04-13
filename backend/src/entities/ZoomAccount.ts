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

  @Column({ nullable: true })
  isActive!: boolean;

  @Column({ nullable: true })
  color!: string; // hex color, e.g. "#ef4444" // enable/disable this account

  // Per-account Zoom API credentials (Server-to-Server OAuth)
  @Column({ nullable: true })
  zoomAccountId!: string; // Zoom Account ID for this account

  @Column({ nullable: true })
  zoomClientId!: string; // Zoom Client ID for this account (OAuth)

  @Column({ nullable: true })
  zoomClientSecret!: string; // Zoom Client Secret for this account (OAuth)

  // Per-account Zoom Meeting SDK credentials
  @Column({ nullable: true })
  zoomSdkKey!: string; // Zoom SDK Key (Meeting SDK app)

  @Column({ nullable: true })
  zoomSdkSecret!: string; // Zoom SDK Secret (Meeting SDK app)

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Booking, (booking) => booking.zoomAccount)
  bookings!: Booking[];
}
