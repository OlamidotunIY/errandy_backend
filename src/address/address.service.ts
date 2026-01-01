import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { SuggestAddressInput } from './dto/suggest-address.input';
import { ReverseGeocodeInput } from './dto/reverse-geocode.input';
import {
  AddressSuggestion,
  AddressDetails,
} from './entities/address-suggestion.entity';
import { UserAddress, GeoPoint } from './entities/address.entity';

import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AddressService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async suggestAddresses(
    input: SuggestAddressInput,
  ): Promise<AddressSuggestion[]> {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input.input,
    )}&key=${apiKey}`;
    const response: AxiosResponse<any> = await axios.get(url);
    return response.data.predictions.map((p: any) => ({
      description: p.description,
      placeId: p.place_id,
    }));
  }

  async reverseGeocode(input: ReverseGeocodeInput): Promise<AddressDetails> {
    const { latitude, longitude } = input;
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

    try {
      const response: AxiosResponse<any> = await axios.get(url);

      if (!response.data.results || response.data.results.length === 0) {
        // Fallback if no specific address found for coordinates
        return {
          formattedAddress: 'Pinned Location', // Fallback label
          latitude,
          longitude,
        };
      }

      const result = response.data.results[0];
      return {
        formattedAddress: result.formatted_address || 'Pinned Location',
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
      };
    } catch (error) {
      console.error('Geocoding error:', error.message);
      // Return basic coordinates if API fails
      return {
        formattedAddress: 'Pinned Location',
        latitude,
        longitude,
      };
    }
  }

  /**
   * Given a Google Place ID, fetches full details including formatted address and coords
   */
  async getPlaceDetails(input: { placeId: string }): Promise<AddressDetails> {
    const { placeId } = input;
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    const url = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${encodeURIComponent(
      placeId,
    )}&key=${apiKey}`;
    const response: AxiosResponse<any> = await axios.get(url);
    const result = response.data.result;
    return {
      formattedAddress: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
    };
  }

  async getUserAddresses(userId: string): Promise<UserAddress[]> {
    const addresses = await this.prisma.userAddress.findMany({
      where: {
        userId,
      },
    });

    return addresses.map((addr) => ({
      ...addr,
      location: addr.location as unknown as GeoPoint,
    }));
  }
}
