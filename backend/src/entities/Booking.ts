import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Professor } from './Professor';
import { ZoomAccount } from './ZoomAccount';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  professorId!: string;

  @Column()
  zoomAccountId!: string;

  @Column()
  title!: string; // e.g. "Clase de Matemática"

  @Column({ type: 'timestamptz' })
  startTime!: Date; // UTC-3 stored as timestampz

  @Column({ type: 'int' })
  durationMinutes!: number; // 30, 60, 90...

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  // Zoom data populated after meeting creation
  @Column({ nullable: true })
  zoomMeetingId!: string;

  @Column({ nullable: true })
  zoomJoinUrl!: string;

  @Column({ nullable: true })
  zoomHostUrl!: string;

  @Column({ nullable: true })
  zoomPassword!: string;

  @Column({ nullable: true })
  zoomEmbedUrl!: string;

  @Column({ nullable: true })
  zoomStartUrl!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Professor, (p) => p.bookings)
  @JoinColumn({ name: 'professorId' })
  professor!: Professor;

  @ManyToOne(() => ZoomAccount, (z) => z.bookings)
  @JoinColumn({ name: 'zoomAccountId' })
  zoomAccount!: ZoomAccount;
}
