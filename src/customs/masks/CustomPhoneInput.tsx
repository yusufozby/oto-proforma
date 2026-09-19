import React from 'react'
import { IMaskInput } from 'react-imask';

// LoginScreen'in dışına ekleyin
const CustomPhoneInput = React.forwardRef<HTMLInputElement, any>((props, ref) => {
    const { onChange, ...other } = props;
    return (
        <IMaskInput
            {...other}
            mask="0(000) 000 00 00"
            definitions={{
                '#': /[1-9]/,
            }}
            inputRef={ref}
            onAccept={(value: any) => onChange({ target: { name: props.name, value } })}
            overwrite
        />
    );
});
export default CustomPhoneInput
