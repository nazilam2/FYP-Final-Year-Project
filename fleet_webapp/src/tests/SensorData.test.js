import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import SensorData from '../SensorData';
import { useParams } from 'react-router-dom';
import * as firebase from '../firebase';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
}));

// Mock firebase functions
jest.mock('../firebase', () => ({
  db: {},
  doc: jest.fn(),
  getDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  getDocs: jest.fn(),
}));

// Mock Chart.js components to prevent rendering issues
jest.mock('react-chartjs-2', () => ({
  Line: () => <div>Line Chart</div>,
  Bar: () => <div>Bar Chart</div>,
  Doughnut: () => <div>Doughnut Chart</div>,
}));

// Global fetch mock
global.fetch = jest.fn();

// Silence console warnings during test output
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('SensorData Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useParams.mockReturnValue({ driverId: 'testDriverId' });

    firebase.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'John Doe',
        email: 'john@example.com',
        vehicleId: 'VH123',
        fleetId: 'FL456',
      }),
    });

    firebase.getDocs.mockResolvedValue({
      docs: [
        {
          id: '1',
          data: () => ({
            timestamp: { toDate: () => new Date() },
            data: {
              Speed: 10,
              BrakingEvents: 1,
              FuelLevel: 80,
              Potentiometer: 30000,
              Accelerometer: { x: 0, y: 0, z: 16384 },
              GPS: { Latitude: 37.7749, Longitude: -122.4194 },
            },
          }),
        },
      ],
    });

    fetch.mockResolvedValueOnce({
      json: async () => ({
        main: { temp: 20, humidity: 60 },
        weather: [{ description: 'clear sky', icon: '01d' }],
        wind: { speed: 3 },
      }),
    });
  });

  it('renders loading initially', () => {
    render(<SensorData />);
    expect(screen.getByText(/loading driver and sensor data/i)).toBeInTheDocument();
  });

  it('renders driver info after load', async () => {
    await act(async () => {
      render(<SensorData />);
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('VH123')).toBeInTheDocument();
    expect(screen.getByText('FL456')).toBeInTheDocument();
  });

  it('displays fuel level correctly', async () => {
    await act(async () => {
      render(<SensorData />);
    });

    expect(screen.getByText(/fuel level/i)).toBeInTheDocument();
    expect(screen.getByText(/% fuel left/i)).toBeInTheDocument();
  });

  it('shows weather data', async () => {
    await act(async () => {
      render(<SensorData />);
    });

    expect(screen.getByText(/clear sky/i)).toBeInTheDocument();
    expect(screen.getByText(/💧 60%/i)).toBeInTheDocument();
  });

  it('handles missing driver data', async () => {
    firebase.getDoc.mockResolvedValueOnce({ exists: () => false });

    await act(async () => {
      render(<SensorData />);
    });

    expect(screen.getByText(/driver data not found/i)).toBeInTheDocument();
  });

  it('handles Firebase error', async () => {
    firebase.getDoc.mockRejectedValueOnce(new Error('Firebase error'));

    await act(async () => {
      render(<SensorData />);
    });

    expect(screen.getByText(/failed to fetch driver data/i)).toBeInTheDocument();
  });
});
