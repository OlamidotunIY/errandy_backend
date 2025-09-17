import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { SuggestAddressInput } from './dto/suggest-address.input';
import { ReverseGeocodeInput } from './dto/reverse-geocode.input';
import { AddressSuggestion, AddressDetails } from './entities/address-suggestion.entity';

@Injectable()
export class AddressService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async suggestAddresses(input: SuggestAddressInput): Promise<AddressSuggestion[]> {
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
    const response: AxiosResponse<any> = await axios.get(url);
    const result = response.data.results[0];
    return {
      formattedAddress: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
    };
  }
}
