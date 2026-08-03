import { CoordinatesType } from '@module/address';
import { ValueObject } from '@src/common';

export class Coordinates extends ValueObject<CoordinatesType> {
  private constructor(props: CoordinatesType) {
    super(props);
  }

  static create(latitude: number, longitude: number): Coordinates {
    if (latitude < -90 || latitude > 90) {
      throw new Error('Invalid latitude');
    }

    if (longitude < -180 || longitude > 180) {
      throw new Error('Invalid longitude');
    }

    return new Coordinates({ latitude, longitude });
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }
}
