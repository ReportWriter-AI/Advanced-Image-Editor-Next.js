declare module 'react-quill-new' {
  import * as React from 'react';

  export interface ReactQuillProps {
    value?: string;
    defaultValue?: string;
    onChange?: (value: string, delta: any, source: any, editor: any) => void;
    modules?: any;
    formats?: string[];
    theme?: string;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
  }

  export default class ReactQuill extends React.Component<ReactQuillProps> {}
}

declare module 'country-state-city' {
  interface CountryType {
    name: string;
    isoCode: string;
    phonecode: string;
    flag: string;
    currency: string;
    latitude: string;
    longitude: string;
  }

  interface StateType {
    name: string;
    isoCode: string;
    countryCode: string;
    latitude: string;
    longitude: string;
  }

  const Country: {
    getAllCountries(): CountryType[];
    getCountryByCode(code: string): CountryType | undefined;
  };

  const State: {
    getStatesOfCountry(countryCode: string): StateType[];
  };

  export { Country, State, CountryType, StateType };
}
