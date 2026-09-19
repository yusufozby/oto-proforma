import React from 'react'
import { IMaskInput } from 'react-imask';

// Telefon: 0(5xx) xxx xx xx
const PhoneMaskInput = React.forwardRef<HTMLInputElement, any>((props, ref) => {
    const { onChange, ...other } = props;
    return (
        <IMaskInput
            {...other}
            mask="0(000) 000 00 00"
            inputRef={ref}
            onAccept={(value: any) => onChange({ target: { name: props.name, value } })}
            overwrite
        />
    );
});

// IBAN: TR00 0000 0000 0000 0000 0000 00
const IbanMaskInput = React.forwardRef<HTMLInputElement, any>((props, ref) => {
    const { onChange, ...other } = props;
    return (
        <IMaskInput
            {...other}
            mask="TR00 0000 0000 0000 0000 0000 00"
            definitions={{
                "0": /[0-9]/,
            }}
            lazy={false}
            placeholderChar=" "
            inputRef={ref}
            onAccept={(value: any) => onChange({ target: { name: props.name, value } })}
            overwrite
        />
    );
});

export default IbanMaskInput
