import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AddressService } from './address.service';
import { UsersService } from 'src/users/users.service';
import { SuggestAddressInput } from './dto/suggest-address.input';
import { ReverseGeocodeInput } from './dto/reverse-geocode.input';
import { PlaceDetailsInput } from './dto/place-details.input';
import {
  AddressSuggestion,
  AddressDetails,
} from './entities/address-suggestion.entity';
import { SaveUserAddressInput } from './dto/save-user-address.input';
import { User as GqlUser } from 'src/users/entities/user.entity';
import { AuthGuard, Session, UserSession } from '@thallesp/nestjs-better-auth';

@Resolver()
@UseGuards(AuthGuard)
export class AddressResolver {
  constructor(
    private readonly addressService: AddressService,
    private readonly usersService: UsersService,
  ) {}

  @Query(() => [AddressSuggestion], { name: 'suggestAddresses' })
  suggestAddresses(
    @Args('input') input: SuggestAddressInput,
  ): Promise<AddressSuggestion[]> {
    return this.addressService.suggestAddresses(input);
  }

  /**
   * Fetch full address details (formatted address + coords) for a Google Place ID
   */
  @Query(() => AddressDetails, { name: 'placeDetails' })
  placeDetails(
    @Args('input') input: PlaceDetailsInput,
  ): Promise<AddressDetails> {
    return this.addressService.getPlaceDetails(input);
  }

  @Mutation(() => GqlUser, { name: 'useCurrentAddress' })
  async useCurrentAddress(
    @Args('input') input: ReverseGeocodeInput,
    @Session() session: UserSession,
  ): Promise<any> {
    const details = await this.addressService.reverseGeocode(input);
    // Prepare CreateAddressInput for service
    const createDto = {
      label: details.formattedAddress,
      address: details.formattedAddress,
      latitude: details.latitude,
      longitude: details.longitude,
    };
    return this.usersService.addAddress(createDto, session.user.id);
  }

  @Mutation(() => GqlUser, { name: 'saveUserAddress' })
  saveUserAddress(
    @Args('dto') dto: SaveUserAddressInput,
    @Session() session: UserSession,
  ): Promise<any> {
    return this.usersService.addAddress(dto, session.user.id);
  }
}
