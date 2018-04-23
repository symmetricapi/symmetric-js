import config from '../config';
import { extendObject } from '../utils';

/**
 * Creating a withModel component will add model change listeners to the component lifecycle.
 * The accepted props are:
 * model - the model to listen for changes on or uses propName if given
 * onChange - optional callback to get notifications when the model was updated within the component
 * @param {Component} WrappedComponent - Any component that should rerender on model changes
 */
export default function (WrappedComponent, propName = 'model') {
  return class extends config.Component {
    constructor(props) {
      super(props);
      this.rerender = this.rerender.bind(this);
    }

    componentDidMount() {
      if (this.props[propName]) {
        this.props[propName].addObserver('change', this.rerender);
      }
    }

    componentWillReceiveProps(nextProps) {
      if (this.props[propName]) {
        this.props[propName].removeObserver('change', this.rerender);
      }
      if (nextProps[propName]) {
        nextProps[propName].addObserver('change', this.rerender);
      }
    }

    componentWillUnmount() {
      if (this.props[propName]) {
        this.props[propName].removeObserver('change', this.rerender);
      }
    }

    rerender(model) {
      this.setState();
      if (this.wrapped.onChange) {
        this.wrapped.onChange(model);
      }
      if (this.props.onChange) {
        this.props.onChange(model);
      }
    }

    render(props) {
      return config.h(WrappedComponent, extendObject(
        { ref: (el) => { this.wrapped = el; } },
        props,
      ));
    }
  };
}
